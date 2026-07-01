import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { exportAgentArtifact } from './agent-artifact-export.mjs';
import { reviseMarkdownArtifactForFollowup, reviseXlsxArtifactForFollowup } from './agent-artifact-revision.mjs';
import { saveAgentArtifactToCustomerMemory } from './agent-customer-memory.mjs';
import { createSkillRuntime } from './skill-runner.mjs';
import { detectSkillCommand as parseSkillCommand, loadSkillRegistry, matchSkillForGoal } from './skill-registry.mjs';

/**
 * detectSkillCommand 识别新对话里的明确 Skill 命令。
 *
 * 作用：
 * - 保留旧测试和旧调用方使用的函数名。
 * - 只解析命令格式，不在这里硬编码任何具体 Skill。
 *
 * 参数：
 * - text：用户输入文本。
 *
 * 返回值：包含 matched、skillId 和 mode 的对象。
 * 可能抛出的异常：无。
 */
export function detectSkillCommand(text) {
  const command = parseSkillCommand(text);
  return {
    matched: Boolean(command.skillId),
    skillId: command.skillId,
    mode: command.skillId ? 'registry' : '',
  };
}

/**
 * detectAgentGoal 从传入注册表中识别自然语言业务目标。
 *
 * 作用：
 * - 让目标识别依赖 registry，而不是在 `skill-agent.mjs` 写死某个 Skill。
 * - 无 registry 时返回未命中，调用方应使用 `runNewConversationAgent()` 自动加载 registry。
 *
 * 参数：
 * - text：用户输入文本。
 * - registry：可选 Skill 注册表。
 *
 * 返回值：目标识别结果。
 * 可能抛出的异常：无。
 */
export function detectAgentGoal(text, registry = null) {
  if (!registry) {
    return {
      matched: false,
      goalType: '',
      skillId: '',
      mode: '',
      periodHint: '',
      trigger: '',
      confidence: 0,
      reason: '',
    };
  }

  const match = matchSkillForGoal({ registry, text });
  return {
    matched: match.matched,
    goalType: match.skill?.id || '',
    skillId: match.skill?.id || '',
    mode: match.skill?.adapter || '',
    periodHint: match.periodHint || '',
    trigger: match.trigger || '',
    confidence: match.confidence || 0,
    reason: match.reason || '',
    skill: match.skill,
  };
}

/**
 * runNewConversationAgent 执行新对话 Agent 的一轮消息。
 *
 * 作用：
 * - 加载 Skill registry，先判断当前输入是新目标还是同 Session 追问。
 * - 新目标交给通用 Skill Runtime 执行。
 * - 同 Session 追问读取上一轮 run log / manifest / artifact 摘要，不重新采集数据。
 *
 * 参数：
 * - options.text：用户输入文本。
 * - options.sessionId：当前 Session ID。
 * - options.context：前端传回的上一轮 artifact / period 摘要。
 * - options.projectRoot：项目根目录。
 * - options.checkPolicy：可选 policy 函数。
 * - options.skillRuntime：可选 Runtime 实例，测试可注入。
 *
 * 返回值：Promise<object>，前端可直接渲染的 Agent 响应。
 * 可能抛出的异常：Runtime 执行失败时向上抛出，由 HTTP 层转错误响应。
 */
export async function runNewConversationAgent(options = {}) {
  const projectRoot = options.projectRoot || process.cwd();
  const registry = options.registry || (await loadSkillRegistry({ projectRoot }));
  let context = options.context || {};
  const text = String(options.text || '').trim();
  const startsFreshTask = shouldStartWithFreshCustomerContext(text);
  if (startsFreshTask) {
    context = clearTaskContinuationContext(context);
  }
  const match = matchSkillForGoal({ registry, text });

  if (options.sessionId && context.pendingConfirmation) {
    if (isCancelMessage(text, context.pendingConfirmation)) {
      return buildConfirmationCancelledResponse({
        context,
        pendingConfirmation: context.pendingConfirmation,
        sessionId: options.sessionId,
      });
    }

    if (isConfirmationMessage(text, context.pendingConfirmation)) {
      const pendingConfirmation = appendInlineConfirmationSupplement(context.pendingConfirmation, text);
      return buildConfirmationAcceptedResponse({
        checkPolicy: options.checkPolicy,
        context: {
          ...context,
          pendingConfirmation,
        },
        pendingConfirmation,
        projectRoot,
        registry,
        sessionId: options.sessionId,
        session: options.session,
        skillRuntime: options.skillRuntime,
        onRuntimeEvent: options.onRuntimeEvent,
      });
    }

    if (shouldKeepConfirmationWaitingForSupplement(context.pendingConfirmation)) {
      return buildConfirmationSupplementResponse({
        context,
        onRuntimeEvent: options.onRuntimeEvent,
        pendingConfirmation: context.pendingConfirmation,
        sessionId: options.sessionId,
        text,
      });
    }

    const { pendingConfirmation: _ignoredPendingConfirmation, ...contextWithoutPendingConfirmation } = context;
    context = contextWithoutPendingConfirmation;
  }

  const riskyAction = detectRiskyAction(text);
  if (riskyAction) {
    const missingArtifact = missingArtifactForRiskyAction({ context, riskyAction });
    if (missingArtifact) {
      if (context.pendingTask) {
        const combinedText = buildPendingTaskResumeText(context.pendingTask, text);
        const combinedMatch = matchSkillForGoal({ registry, text: combinedText });
        if (combinedMatch.matched) {
          const missingContext = detectMissingBusinessContext({ match: combinedMatch, text: combinedText });
          if (missingContext.missing.length === 0) {
            const bufferedRuntimeEvents = [];
            const collectRuntimeEvent = async (event) => {
              bufferedRuntimeEvents.push(event);
            };
            const generatedResponse = await runMatchedSkillGoal({
              checkPolicy: options.checkPolicy,
              projectRoot,
              resumeRuntime: context.pendingTask.runtime,
              sessionId: options.sessionId,
              skillRuntime: options.skillRuntime,
              onRuntimeEvent: collectRuntimeEvent,
              text: combinedText,
            });

            if (generatedResponse.ok !== false && generatedResponse.kind !== 'confirmation-required' && generatedResponse.artifact) {
              return buildPostArtifactRiskConfirmationResponse({
                onRuntimeEvent: options.onRuntimeEvent,
                response: generatedResponse,
                runtimeEvents: bufferedRuntimeEvents,
                riskyAction,
                text: combinedText,
              });
            }

            await emitBufferedRuntimeEvents(options.onRuntimeEvent, bufferedRuntimeEvents);
            return generatedResponse;
          }
        }

        return buildNeedsInputContinuationResponse({
          context,
          missing: missingArtifact.missing,
          onRuntimeEvent: options.onRuntimeEvent,
          sessionId: options.sessionId,
          text,
        });
      }
      if (shouldGenerateArtifactBeforeRiskConfirmation({ match, riskyAction })) {
        const missingContext = detectMissingBusinessContext({ match, text });
        if (missingContext.missing.length === 0) {
          const bufferedRuntimeEvents = [];
          const collectRuntimeEvent = async (event) => {
            bufferedRuntimeEvents.push(event);
          };
          const generatedResponse = await runMatchedSkillGoal({
            checkPolicy: options.checkPolicy,
            projectRoot,
            sessionId: options.sessionId,
            skillRuntime: options.skillRuntime,
            onRuntimeEvent: collectRuntimeEvent,
            text,
          });

          if (generatedResponse.ok !== false && generatedResponse.kind !== 'confirmation-required' && generatedResponse.artifact) {
            return buildPostArtifactRiskConfirmationResponse({
              onRuntimeEvent: options.onRuntimeEvent,
              response: generatedResponse,
              runtimeEvents: bufferedRuntimeEvents,
              riskyAction,
              text,
            });
          }

          await emitBufferedRuntimeEvents(options.onRuntimeEvent, bufferedRuntimeEvents);
          return generatedResponse;
        }

        return buildNeedsInputResponse({
          missing: missingContext.missing,
          matchedSkill: match.skill,
          onRuntimeEvent: options.onRuntimeEvent,
          projectRoot,
          sessionId: options.sessionId,
          text,
        });
      }
      return buildNeedsInputResponse({
        missing: missingArtifact.missing,
        onRuntimeEvent: options.onRuntimeEvent,
        projectRoot,
        sessionId: options.sessionId,
        text,
      });
    }
    const confirmationText = context.pendingTask
      ? buildPendingTaskResumeText(context.pendingTask, text)
      : text;
    return buildRiskConfirmationResponse({
      context,
      onRuntimeEvent: options.onRuntimeEvent,
      riskyAction,
      text: confirmationText,
      sessionId: options.sessionId,
    });
  }

  if (options.sessionId && context.pendingTask) {
    const combinedText = buildPendingTaskResumeText(context.pendingTask, text);
    const combinedMatch = matchSkillForGoal({ registry, text: combinedText });
    if (combinedMatch.matched) {
      const missingContext = detectMissingBusinessContext({ match: combinedMatch, text: combinedText });
      if (missingContext.missing.length > 0) {
        return buildNeedsInputContinuationResponse({
          context: {
            pendingTask: {
              ...context.pendingTask,
              missing: missingContext.missing,
              skillId: combinedMatch.skill?.id || '',
              skillName: combinedMatch.skill?.displayName || '',
            },
          },
          missing: missingContext.missing,
          onRuntimeEvent: options.onRuntimeEvent,
          sessionId: options.sessionId,
          skill: combinedMatch.skill,
          text,
        });
      }
      return runMatchedSkillGoal({
        checkPolicy: options.checkPolicy,
        projectRoot,
        resumeRuntime: context.pendingTask.runtime,
        sessionId: options.sessionId,
        skillRuntime: options.skillRuntime,
        onRuntimeEvent: options.onRuntimeEvent,
        text: combinedText,
      });
    }

    if (!match.matched) {
      return buildNeedsInputContinuationResponse({
        context,
        sessionId: options.sessionId,
        text,
      });
    }
  }

  if (shouldHandleAsCurrentArtifactFollowup({
    context,
    session: options.session,
    sessionId: options.sessionId,
    startsFreshTask,
    text,
  })) {
    return buildAgentFollowupResponse({
      context,
      onRuntimeEvent: options.onRuntimeEvent,
      projectRoot,
      session: options.session,
      sessionId: options.sessionId,
      text,
    });
  }

  if (options.sessionId && !startsFreshTask && !match.matched) {
    return buildAgentFollowupResponse({
      context,
      onRuntimeEvent: options.onRuntimeEvent,
      projectRoot,
      session: options.session,
      sessionId: options.sessionId,
      text,
    });
  }

  if (!match.matched) {
    return buildNeedsInputResponse({
      onRuntimeEvent: options.onRuntimeEvent,
      projectRoot,
      text,
    });
  }

  const missingContext = detectMissingBusinessContext({ match, text });
  if (missingContext.missing.length > 0) {
    const threadContextText = buildThreadContextGoalText({
      context,
      session: options.session,
      text,
    });
    if (threadContextText !== text) {
      const carriedContext = detectMissingBusinessContext({ match, text: threadContextText });
      if (carriedContext.missing.length === 0) {
        return runMatchedSkillGoal({
          checkPolicy: options.checkPolicy,
          projectRoot,
          sessionId: options.sessionId,
          skillRuntime: options.skillRuntime,
          onRuntimeEvent: options.onRuntimeEvent,
          text: threadContextText,
        });
      }
    }
    return buildNeedsInputResponse({
      matchedSkill: match.skill,
      missing: missingContext.missing,
      onRuntimeEvent: options.onRuntimeEvent,
      projectRoot,
      text,
    });
  }

  return runMatchedSkillGoal({
    checkPolicy: options.checkPolicy,
    projectRoot,
    sessionId: options.sessionId,
    skillRuntime: options.skillRuntime,
    onRuntimeEvent: options.onRuntimeEvent,
    text,
  });
}

/**
 * runMatchedSkillGoal 执行已经匹配到的外贸任务。
 *
 * 作用：
 * - 让普通新目标和“等待资料后继续”的目标共用同一条执行路径。
 * - 避免两处分别创建 Runtime、处理错误和包装响应时出现行为分叉。
 *
 * 参数：
 * - input.text：要执行的完整业务目标。
 * - input.projectRoot：项目根目录。
 * - input.sessionId：当前任务线程 ID，可为空。
 * - input.checkPolicy：policy 检查函数。
 * - input.skillRuntime：测试注入的 Runtime。
 * - input.onRuntimeEvent：Runtime 事件回调,用于流式前台进度。
 *
 * 返回值：Promise<object>，前端可直接渲染的 Agent 响应。
 * 可能抛出的异常：Runtime 内部异常会向上抛出，由 HTTP 层处理。
 */
async function runMatchedSkillGoal(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const runtime =
    input.skillRuntime ||
    createSkillRuntime({
      checkPolicy: input.checkPolicy,
      onEvent: input.onRuntimeEvent,
      projectRoot,
    });
  const runtimeInput = {
    text: input.text,
    onRuntimeEvent: input.onRuntimeEvent,
  };
  if (input.resumeRuntime?.runId) {
    runtimeInput.runId = input.resumeRuntime.runId;
    runtimeInput.resumeFromCheckpoint = {
      resume_from: input.resumeRuntime.resumeFrom,
      runId: input.resumeRuntime.runId,
      status: 'waiting',
    };
  }
  const result = await runtime.runGoal(runtimeInput);

  if (result.ok === false) {
    return {
      ok: false,
      error: result.error || 'SKILL_RUNTIME_FAILED',
      message: '这次任务处理卡住了。我没有生成业务材料,需要检查任务资料或处理方式后再继续。',
      loop: result.loop,
      runId: result.runId,
    };
  }

  return buildSkillAgentResponse({
    result,
    sessionId: input.sessionId,
    userText: input.text,
  });
}

/**
 * buildPendingTaskResumeText 把等待补资料的任务恢复成完整执行目标。
 *
 * 作用：
 * - 用户第二句话通常只说“产品是太阳能路灯”这种补充,不能让 Runtime 只看到这半句话。
 * - 把原始目标、已累积补充、本轮补充和已识别的产出类型合并,让后续执行更稳定。
 *
 * 参数：
 * - pendingTask：上一轮 needs-input 存下来的任务上下文。
 * - supplementText：用户本轮补充的资料或动作。
 *
 * 返回值：可以直接交给 matchSkillForGoal / runMatchedSkillGoal 的完整目标文本。
 * 可能抛出的异常：无。
 */
function buildPendingTaskResumeText(pendingTask = {}, supplementText = '') {
  const supplements = Array.isArray(pendingTask.supplements) ? pendingTask.supplements : [pendingTask.lastSupplement].filter(Boolean);
  const skillInstruction = pendingTask.skillName ? `产出类型: ${pendingTask.skillName}` : '';
  return [skillInstruction, pendingTask.originalText, ...supplements, supplementText]
    .filter(Boolean)
    .join('；补充资料: ');
}

/**
 * buildThreadContextGoalText 用同一线程里的真实用户资料补全新任务目标。
 *
 * 作用：
 * - 用户完成一份材料后,常会直接说“再做一个客户推进计划”。
 * - 这时不能像失忆一样重新追问客户和产品,也不能凭空补资料。
 * - 这里只复用 session 中最近几条真实用户消息,不读取内部 runId / 路径 / tool 信息。
 *
 * 参数：
 * - input.session：后端保存的新对话线程,包含真实用户消息。
 * - input.text：用户本轮新任务。
 *
 * 返回值：包含「本线程已有资料」和「本轮任务」的人可读目标文本；没有可复用资料时返回原文。
 * 可能抛出的异常：无。
 */
function buildThreadContextGoalText(input = {}) {
  const text = String(input.text || '').trim();
  if (shouldStartWithFreshCustomerContext(text)) {
    return text;
  }
  const userFacts = extractRecentUserThreadFacts(input.session);
  if (!text || userFacts.length === 0) {
    return text;
  }

  return [`本线程已有资料: ${userFacts.join('；')}`, `本轮任务: ${text}`].join('；');
}

/**
 * shouldStartWithFreshCustomerContext 判断本轮是否明确换了客户对象。
 *
 * 作用：
 * - 用户说“另一个客户 / 新客户 / 换个买家”时,旧线程事实不能继续当依据。
 * - 这类请求宁可追问新客户资料,也不能把上一位客户的国家、产品和问题套过去。
 *
 * 参数：
 * - text：用户本轮输入。
 *
 * 返回值：明确换客户时返回 true。
 * 可能抛出的异常：无。
 */
export function shouldStartWithFreshCustomerContext(text = '') {
  const compact = String(text || '').replace(/\s+/g, '');
  const resetWords = /(?:重新开始|从头开始|重开|开新任务|新任务|开始新任务|另起一条|另起一个)/u;
  const negatedResetWords = /(?:不要|别|不用|无需|先别|先不要|先不用|不需要)(?:重新开始|从头开始|重开|开新任务|新任务|开始新任务|另起一条|另起一个)|(?:不是|并不是)(?:要)?(?:重新开始|从头开始|重开|开新任务|新任务|开始新任务|另起一条|另起一个)/u;
  const rejectsOldContext = /(?:不要沿用|别沿用|不要用上(?:一|个)任务|别用上(?:一|个)任务)/u.test(compact);
  const explicitlyRestartsTask = rejectsOldContext || (!negatedResetWords.test(compact) && resetWords.test(compact));
  const switchesCustomer = /(?:另一个|另个|另外一个|新的?|换个|换一个|下一个|第二个)(?:客户|买家|采购商|客人|联系人)|(?:客户|买家|采购商|客人)(?:换一个|换个|另一个|新的?)/u.test(compact);
  return explicitlyRestartsTask || switchesCustomer;
}

/**
 * clearTaskContinuationContext 清掉会把旧任务带入本轮执行的上下文。
 *
 * 作用：
 * - 用户明确说“重新开始 / 新任务 / 不要沿用”时,旧 waiting、确认卡和产物都不能继续影响本轮判断。
 * - 保留其他非任务续接字段,避免无关前端状态被无意义抹掉。
 *
 * 参数：
 * - context：上一轮新对话上下文。
 *
 * 返回值：不含 pendingTask、pendingConfirmation、artifact 等旧任务续接字段的新对象。
 * 可能抛出的异常：无。
 */
function clearTaskContinuationContext(context = {}) {
  const {
    artifact: _artifact,
    customerSlug: _customerSlug,
    lastCustomerSave: _lastCustomerSave,
    pendingConfirmation: _pendingConfirmation,
    pendingTask: _pendingTask,
    period: _period,
    ...rest
  } = context || {};
  return rest;
}

/**
 * extractRecentUserThreadFacts 提取最近几条真实用户业务资料。
 *
 * 作用：
 * - 只取用户说过的话,避免把 Agent 生成的推测当成事实。
 * - 清理旧恢复文本里的内部拼接标记,防止 `产出类型 / 补充资料` 进入 Runtime 目标。
 *
 * 参数：
 * - session：后端 session 对象。
 *
 * 返回值：最多 3 条可复用用户资料。
 * 可能抛出的异常：无。
 */
function extractRecentUserThreadFacts(session = {}) {
  const messages = Array.isArray(session?.messages) ? session.messages : [];
  return messages
    .filter((message) => message?.role === 'user')
    .map((message) => cleanThreadFactText(message.content))
    .filter(Boolean)
    .slice(-3);
}

/**
 * cleanThreadFactText 清理同线程事实文本。
 *
 * 参数：
 * - value：用户消息内容。
 *
 * 返回值：单行、限长、去掉内部恢复标记后的文本。
 * 可能抛出的异常：无。
 */
function cleanThreadFactText(value = '') {
  const text = extractBusinessFactSegment(String(value || ''))
    .replace(/产出类型\s*[:：]/g, '')
    .replace(/补充资料\s*[:：]/g, '；')
    .replace(/(?:帮我|请|麻烦)?(?:准备|生成|写|做|整理)?(?:一封|一个|一下)?(?:跟进)?(?:开发信|开发邮件|邮件|草稿)[，,;；。.]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

/**
 * extractBusinessFactSegment 从用户旧消息里截取更像事实的部分。
 *
 * 作用：
 * - 旧消息常以“帮我写开发信”开头,那是上一轮任务意图,不是下一轮应该复用的事实。
 * - 一旦看到客户、产品、询盘或客户问题等事实锚点,只保留从该锚点开始的内容。
 *
 * 参数：
 * - value：用户旧消息。
 *
 * 返回值：事实片段；没有锚点时返回原文,再交给后续清理。
 * 可能抛出的异常：无。
 */
function extractBusinessFactSegment(value = '') {
  const text = String(value || '').trim();
  const anchor = text.search(/客户(?:是|叫|问|说|提到)|产品|询盘|买家|采购商|进口商|批发商|经销商|他(?:问|说|提到)|她(?:问|说|提到)|他们(?:问|说|提到)/u);
  if (anchor < 0) {
    return text;
  }
  return text.slice(anchor);
}

function detectMissingBusinessContext(input = {}) {
  const skill = input.match?.skill || {};
  const text = String(input.text || '').trim();
  if (!['business-draft', 'quotation-sheet'].includes(skill.adapter)) {
    return { missing: [] };
  }

  const requiredSignals = businessContextRequirementsForSkill(skill.id);
  if (!requiredSignals.length) {
    return { missing: [] };
  }

  const signals = detectBusinessSignals(text);
  const missing = requiredSignals.filter((requirement) => !signals[requirement.signal]).map((requirement) => requirement.label);
  const strongSignalCount = [signals.market, signals.product, signals.inquiry, signals.customerSpecific].filter(Boolean).length;

  if (skill.id === 'cold-email-draft' && !signals.product) {
    return { missing };
  }
  if (skill.id === 'cold-email-draft' && strongSignalCount >= 2) {
    return { missing: [] };
  }
  if (skill.id === 'customer-followup-plan' && signals.exclusiveAgencyIssue && !signals.productCoreContext) {
    return { missing: ['产品或核心卖点'] };
  }
  if (skill.id === 'customer-followup-plan' && signals.followupCadenceRequested && !signals.productCoreContext) {
    return { missing: ['产品或核心卖点'] };
  }
  if (skill.id === 'customer-followup-plan' && signals.productDependentIssue && !signals.productCoreContext) {
    return { missing: ['产品或核心卖点'] };
  }
  if (skill.id === 'customer-followup-plan' && signals.customer && !signals.genericCustomerOnly && signals.currentIssue) {
    return { missing: [] };
  }
  if (skill.id === 'inquiry-reply-draft' && signals.inquiry && signals.replyProductContext) {
    return { missing: [] };
  }

  return { missing };
}

function businessContextRequirementsForSkill(skillId = '') {
  const requirements = {
    'cold-email-draft': [
      { signal: 'customer', label: '客户名称或客户类型' },
      { signal: 'product', label: '产品或核心卖点' },
      { signal: 'market', label: '目标市场或客户所在国家' },
    ],
    'customer-followup-plan': [
      { signal: 'customer', label: '客户名称或客户类型' },
      { signal: 'currentIssue', label: '询盘、聊天记录或当前卡点' },
    ],
    'inquiry-reply-draft': [
      { signal: 'inquiry', label: '询盘原文或客户问题' },
      { signal: 'replyProductContext', label: '产品资料或报价边界' },
    ],
    'quotation-sheet': [
      { signal: 'quoteProduct', label: '产品资料' },
      { signal: 'quantity', label: '数量' },
      { signal: 'priceTerm', label: '单价或报价区间' },
      { signal: 'tradeTerm', label: '币种和贸易条款' },
    ],
  };
  return requirements[skillId] || [];
}

/**
 * isCustomerHesitationIssue 判断观望/拖延是否来自客户原话。
 *
 * 作用：
 * - `客户说再考虑一下`、`买家说先看看` 是有效当前卡点,可以进入客户推进分析。
 * - `我先看看`、`之后再说` 可能是用户自己的操作语气,不能当成客户证据。
 * - 这里要求观望词附近有客户/买家/对方作为主语,或有明确的“说/表示/回复”等转述动作。
 *
 * 参数：
 * - text：用户本轮输入文本。
 *
 * 返回值：boolean, true 表示这是客户侧观望/拖延决策信号。
 * 可能抛出的异常：无。
 */
function isCustomerHesitationIssue(text = '') {
  const value = String(text || '').toLowerCase();
  const customerActor = '(?:客户|买家|采购商|客人|对方|buyer|customer|client)';
  const speechVerb = '(?:说|表示|回复|提到|反馈|讲|一直说|总说|说要|说想|says?|said|replied|mentioned)';
  const hesitation = '(?:观望|犹豫|再考虑|考虑一下|先看看|再看看|之后再说|以后再说|回头再说|暂缓|待定|还没决定|wait\\s+and\\s+see|still\\s+considering|not\\s+decided|undecided|hesitat(?:e|ing|ion))';
  const quotedByCustomer = new RegExp(`${customerActor}[^，。,.!?！？]{0,8}${speechVerb}[^，。,.!?！？]{0,16}${hesitation}`, 'i');
  const stateOnCustomer = new RegExp(`${customerActor}[^，。,.!?！？]{0,8}(?:还在|正在|一直|仍在|比较)?${hesitation}`, 'i');
  return quotedByCustomer.test(value) || stateOnCustomer.test(value);
}

/**
 * hasProductCoreContext 判断文本里是否真的给了产品或核心卖点。
 *
 * 作用：
 * - `产品太阳能灯`、`产品是ABC-123`、`卖点是IP65防水` 应该算产品上下文。
 * - `客户问产品质保多久`、`客户要产品CE认证` 只是客户问题里带了“产品”二字,不能算产品资料。
 * - 这个判断只服务缺资料 gate,避免售前问题在缺产品时直接跑 Runtime。
 *
 * 参数：
 * - text：用户输入的自然语言。
 *
 * 返回值：boolean, true 表示已有足够的产品名、规格、型号或核心卖点线索。
 * 可能抛出的异常：无。
 */
function hasProductCoreContext(text = '') {
  const value = String(text || '');
  const lower = value.toLowerCase();
  const concreteProductNamePattern = /太阳能|路灯|灯具|灯|家具|服装|电池|设备|机器|配件|\b(?:solar|light|lamp|battery|machine|equipment)\b/i;
  if (concreteProductNamePattern.test(lower)) {
    return true;
  }

  const issueOnlyPattern = /^(?:产品|product|item|goods|质保|保修|warranty|guarantee|认证|合规|证书|certification|certificate|certrequirements?|cecert|compliance|验厂|厂审|factoryaudit|factoryinspection|supplieraudit|ce|rohs|fba|amazonfba|亚马逊fba|中性包装|包装|package|packagerequirements?|packaging|packagingrequirements?|neutralpackage|neutralpackaging|oem|odm|贴牌|privatelabel|定制logo|customlogo|customization|customisation|定制|logo|安装|installation|说明书|manual|价格|报价|price|quote|moq|起订|交期|leadtime|delivery|样品|sample|付款|paymentterms|售后|aftersales)(?:多久|多少|能不能|可不可以|可以吗|吗|要求|问题|资料)?$/i;
  const issueTermPattern = /质保|保修|warranty|guarantee|认证|合规|证书|certification|certificate|certrequirements|cecert|compliance|验厂|厂审|factoryaudit|factoryinspection|supplieraudit|rohs|fba|amazonfba|亚马逊fba|中性包装|包装(?:要求|问题|资料)|packagerequirements|packagingrequirements|neutralpackage|neutralpackaging|oem|odm|贴牌|privatelabel|定制|customlogo|customization|customisation|logo|安装|installation|说明书|manual|价格|报价|price|quote|moq|起订|交期|leadtime|delivery|样品|sample|付款|paymentterms|售后|aftersales/i;
  const genericFieldQuestionPattern = /怎么|如何|怎样|多少|多久|可不可以|能不能|可以吗|下一步|推进|处理|回复|回|一下|帮我|客户|买家|what|how|next|reply|follow|emphasize|highlight/i;
  const productFieldPattern = /(?:产品|品名|款式|规格|型号|卖点|材质|尺寸|product|item|goods|model|spec|material|size)\s*(?:是|为|叫|:|：)?\s*([^，。,.!?！？;；]{2,48})/gi;

  for (const match of value.matchAll(productFieldPattern)) {
    const phrase = String(match[1] || '').trim();
    const normalized = phrase.toLowerCase().replace(/[\s_-]+/g, '');
    if (!normalized || issueOnlyPattern.test(normalized)) {
      continue;
    }
    if (genericFieldQuestionPattern.test(normalized)) {
      continue;
    }
    if (issueTermPattern.test(normalized) && !concreteProductNamePattern.test(normalized)) {
      continue;
    }
    return true;
  }

  return false;
}

function detectBusinessSignals(text = '') {
  const value = String(text || '');
  const lower = value.toLowerCase();
  const compact = value.replace(/\s/g, '');
  const marketPattern = /德国|美国|巴西|英国|法国|意大利|西班牙|加拿大|澳大利亚|印度|越南|泰国|日本|韩国|中东|欧洲|北美|南美|非洲|东南亚|germany|usa|brazil|uk|france|india|vietnam|europe|market/i;
  const productPattern = /产品|规格|型号|卖点|报价|价格|底价|moq|起订|小批量|小单|试单|交期|lead\s*time|delivery|样品|sample|付款|账期|赊账|月结|付款条件|付款方式|质量|售后|库存|材质|尺寸|quantity|price|quote|payment\s+terms|credit\s+terms/i;
  const inquiryPattern = /询盘|邮件|聊天|客户(?:说|问|要|要求|需要|想要)|买家(?:说|问|要|要求|需要|想要)|问了|问|需求|投诉|异议|报价|回复|回信|沉默|订单|认证|合规|证书|验厂|资质|inquiry|rfq|reply|certification|certificate|compliance|factory\s+audit|supplier\s+audit/i;
  const currentIssuePattern = /(?:客户|买家|采购商|客人|对方)(?:说|问|提到|要求|抱怨|投诉|反馈)[^，。,.!?！？]{0,24}(?:moq|起订|交期|lead\s*time|delivery|价格|报价|样品|付款|账期|赊账|月结|付款条件|付款方式|数量|规格|认证|合规|证书|验厂|资质|质保|保修|oem|odm|贴牌|定制|logo|安装|说明书|使用手册|fba|亚马逊|中性包装|包装|质量|售后|异议|投诉|抱怨|沉默|不回|已读不回|嫌贵|太贵|折扣|代理|渠道|cert[-\s]*requirements?|ce[-\s]?cert)|问了.+|问.*(?:moq|起订|交期|lead\s*time|delivery|价格|报价|样品|付款|账期|赊账|月结|付款条件|付款方式|数量|规格|认证|合规|证书|验厂|资质|质保|保修|oem|odm|贴牌|定制|logo|安装|说明书|使用手册|fba|亚马逊|中性包装|包装|质量|售后|cert[-\s]*requirements?|ce[-\s]?cert)|投诉|抱怨|异议|沉默|已读不回|没回复|未回复|不回复|不回消息|不回信|没回|卡点|嫌贵|太贵|贵了|价格(?:太)?高|砍价|压价|还价|议价|让价|降价|折扣|报价|价格|底价|moq|起订|小批量|小单|试单|小数量|少量试|低于\s*moq|moq\s*太高|起订量太高|独家代理|独代|代理权|区域代理|总代理|渠道代理|经销代理|分销代理|交期|lead\s*time|delivery|样品|sample|付款|账期|赊账|月结|付款条件|付款方式|质量(?:不行|问题|投诉)?|货有问题|售后|认证|合规|证书|验厂|厂审|工厂审核|资质|质保|保修|oem|odm|贴牌|定制|logo|安装|说明书|使用手册|fba|亚马逊|中性包装|包装|quantity|price|quote|small\s+(?:trial\s+)?order|trial\s+order|exclusive\s+(?:agent|agency|distributor)|distribution\s+rights|too\s+expensive|price\s+too\s+high|discount|payment\s+terms|credit\s+terms|quality\s+(?:issue|complaint|problem)|after[-\s]?sales|certification|certificate|cert[-\s]*requirements?|ce[-\s]?cert|compliance|\bce\b|rohs|warranty|guarantee|private\s+label|custom\s+logo|customi[sz]ation|installation|manual|amazon\s*fba|factory\s+audit|factory\s+inspection|supplier\s+audit/i;
  const customerPattern = /采购商|买家|对方|公司|联系人|进口商|批发商|零售商|经销商|代理商|客户(?:名称|类型|是|叫)|客户(?:说|问|提到).+|buyer|customer\s+(?:is|type|name)|client\s+(?:is|type|name)|importer|distributor|wholesaler|retailer/i;
  const quantityPattern = /(?:数量|qty|quantity)\s*(?:是|为|:|：|,|，)?\s*\d+|\d+\s*(?:套|件|个|箱|台|pcs|pieces|units?|cartons?)/i;
  const priceTerm = hasQuotationPriceTerm(value);
  const tradeTermPattern = /\b(?:fob|cif|exw|ddp|dap|cfr)\b|美元|美金|人民币|usd|rmb|us\$|\$|¥|贸易条款|付款条款|目的港|港口/i;
  const genericCustomerOnly = /^帮?我?(分析|处理|推进|判断|整理)?(一下)?(这个|该个|该)?(客户|买家|采购商|客人)(怎么)?(推进|跟进|分析|成交|优先级|机会|意向|有没有机会成交)?(一下)?$/u.test(compact) ||
    /^(分析|判断)(一下)?(这个|该个|该)?(客户|买家|采购商|客人)(有没有机会成交|优先级|机会|意向)?$/u.test(compact);
  const currentIssue = currentIssuePattern.test(lower) || isCustomerHesitationIssue(value) || isCustomerPurchaseIntent(value);
  const customerActorWithIssue = /客户|买家|采购商|客人|对方|buyer|customer|client/i.test(lower) && currentIssue;
  const exclusiveAgencyIssue = /独家代理|独代|代理权|区域代理|总代理|渠道代理|经销代理|分销代理|exclusive\s+(?:agent|agency|distributor)|distribution\s+rights/.test(lower);
  const productDependentIssue = /认证|合规|证书|验厂|厂审|工厂审核|资质|质保|保修|oem|odm|贴牌|定制|logo|安装|说明书|使用手册|fba|亚马逊|中性包装|包装|certification|certificate|cert[-\s]*requirements?|ce[-\s]?cert|compliance|\bce\b|rohs|warranty|guarantee|after[-\s]?sales|private[-\s]?label|custom[-\s]?logo|customi[sz]ation|installation|manual|amazon\s*fba|payment[-\s]?terms|lead[-\s]?time|packag(?:e|ing)(?:[-\s]?requirements?)?|factory[-\s]?audit|factory[-\s]?inspection|supplier[-\s]?audit/.test(lower);
  const followupCadenceRequested = /7\s*天|七天|一周|1\s*周|7-day|seven[-\s]?day|weekly/.test(lower) &&
    /跟进|回访|节奏|计划|follow[-\s]?up/.test(lower);
  const productCoreContext = hasProductCoreContext(value);

  return {
    customer: customerPattern.test(lower) || marketPattern.test(lower) || customerActorWithIssue,
    customerSpecific: !genericCustomerOnly && (marketPattern.test(lower) || /[A-Z][A-Za-z0-9&.\s]{2,}/.test(value)),
    genericCustomerOnly,
    currentIssue,
    exclusiveAgencyIssue,
    productDependentIssue,
    followupCadenceRequested,
    inquiry: inquiryPattern.test(lower),
    market: marketPattern.test(lower),
    priceTerm,
    product: productPattern.test(lower),
    // 质保/OEM/安装/FBA/包装/认证等售前问题需要真实产品或卖点上下文；
    // 单独的价格、MOQ、交期、样品、付款等商业词不能绕过等待补充。
    productCoreContext,
    // 询盘回复需要能写进正文的产品上下文,不能把单独的 MOQ/交期问题当成产品资料。
    replyProductContext: productCoreContext || priceTerm || tradeTermPattern.test(value),
    // 报价单必须知道具体报什么产品；“报价/价格”只是任务意图,不能当成产品资料。
    quoteProduct: productCoreContext,
    quantity: quantityPattern.test(value),
    tradeTerm: tradeTermPattern.test(value),
  };
}

/**
 * hasQuotationPriceTerm 判断文本里是否已有可用于报价单的单价/报价。
 *
 * 作用：
 * - 识别 `单价USD 35` 这类显式字段。
 * - 也识别报价任务里的口语金额,例如 `帮我做PI,太阳能路灯500套,35美金,FOB上海`。
 * - 避免把 `样品费35 USD`、`运费35 USD` 当成报价单单价。
 *
 * 参数：
 * - text：用户输入。
 *
 * 返回值：boolean,true 表示可作为报价单价格依据。
 * 可能抛出的异常：无。
 */
function hasQuotationPriceTerm(text = '') {
  const value = String(text || '');
  const explicit = /(?:单价|底价|目标价|价格|报价)\s*(?:是|为|:|：|,|，)?\s*(?:usd|us\$|\$|rmb|¥|人民币|美元|美金)?\s*\d+(?:\.\d+)?\s*(?:usd|美元|美金|rmb|人民币|元)?/i;
  if (explicit.test(value)) {
    return true;
  }

  const quoteIntent = /报价单|报价|做\s*pi|生成\s*pi|整理\s*pi|proforma|客户问报价|客户要报价|客户要price|客户问price/i.test(value);
  if (!quoteIntent) {
    return false;
  }

  return findBareQuotationCurrencyAmount(value) !== '';
}

/**
 * findBareQuotationCurrencyAmount 从报价任务里找没有字段名但带币种的金额。
 *
 * 参数：
 * - text：用户输入。
 *
 * 返回值：金额文本；未识别时返回空字符串。
 * 可能抛出的异常：无。
 */
function findBareQuotationCurrencyAmount(text = '') {
  const value = String(text || '');
  const amountPattern = /(?:usd|us\$|\$|rmb|¥|人民币|美元|美金)\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:usd|美元|美金|rmb|人民币|元)/gi;
  for (const match of value.matchAll(amountPattern)) {
    // 32 个字符能覆盖 `shipping cost USD 35` / `freight cost USD 35` 这类英文费用标签。
    const before = value.slice(Math.max(0, match.index - 32), match.index);
    if (/样品费|样品|sample(?:\s+fee|\s+cost)?|运费|物流|快递|海运|空运|shipping(?:\s+fee|\s+cost)?|freight(?:\s+fee|\s+cost)?/i.test(before)) {
      continue;
    }
    return match[0].replace(/\s+/g, '').trim();
  }
  return '';
}

/**
 * isCustomerPurchaseIntent 判断一句话是否在说客户侧采购意向。
 *
 * 作用：
 * - `客户想购买500套太阳能灯` 已经是明确推进卡点,不应继续追问“当前卡点”。
 * - 只识别客户/买家/采购商等主体附近的购买、采购、下单、订购表达。
 * - 不把“购买/买/订购 套餐、积分、额度”当客户意向,这类仍交给 paid action 保护。
 *
 * 参数：
 * - text：用户本轮输入文本。
 *
 * 返回值：boolean,true 表示客户已经表达采购或下单意向。
 * 可能抛出的异常：无。
 */
function isCustomerPurchaseIntent(text = '') {
  const value = String(text || '').toLowerCase();
  const paidObjectPattern = /(?:购买|采购(?!商)|下单|订购|买(?!家))[^，。,.!?！？]{0,8}(?:套餐|积分|点数|额度|付费服务|收费服务)/;
  if (paidObjectPattern.test(value)) {
    return false;
  }
  const customerActor = '(?:客户|买家|采购商|客人|对方|buyer|customer|client)';
  // `买(?!家)` 防止把“买家”这个身份名词误当成“购买”动作。
  const purchaseVerb = '(?:想|要|准备|计划|考虑|打算|有意向)?(?:购买|采购(?!商)|下单|订购|买(?!家)|place\\s+an?\\s+order|purchase|buy)';
  return new RegExp(`${customerActor}[^，。,.!?！？]{0,12}${purchaseVerb}`, 'i').test(value);
}

/**
 * detectRiskyAction 识别新对话里需要先确认的高风险动作。
 *
 * 作用：
 * - 保护外发、保存、导出和付费动作,让它们先停在等待确认状态。
 * - 只做用户可见体验层的轻量判断,真正安全边界仍由 policy/runtime 执行。
 *
 * 参数：
 * - text：用户输入文本。
 *
 * 返回值：命中的风险动作对象；没有命中时返回 null。
 * 可能抛出的异常：无。
 */
function detectRiskyAction(text = '') {
  const value = String(text).toLowerCase();
  const rules = [
    {
      type: 'external_send',
      keywords: ['外发', '发送给客户', '发给客户', '发邮件', 'send email', 'whatsapp', '站内信'],
      patterns: [/发(?:送)?给[^，。,.!?！？]{0,12}(?:客户|买家|采购商|客人)/, /发到[^，。,.!?！？]{0,12}(?:客户|买家|采购商|客人)/],
      title: '外发前需要你确认',
      body: '这一步会把内容发到客户或外部渠道。正式执行前需要你确认收件人、正文和附件。当前我可以先生成草稿,不会自动发送。',
      confirmLabel: '先生成草稿',
    },
    {
      type: 'paid_call',
      keywords: ['扣费', '付费', '消耗点数', '消耗额度', '消耗积分', '收费接口', '付费接口', '充值', 'paid api'],
      patterns: [
        /花钱/,
        /产生费用/,
        /扣[^，。,.!?！？]{0,8}(?:点数|额度|费用|积分)/,
        /消耗[^，。,.!?！？]{0,8}(?:点数|额度|积分)/,
        /调用[^，。,.!?！？]{0,12}(?:付费|收费)[^，。,.!?！？]{0,8}(?:接口|数据|能力|工具)?/,
        /(?:购买|采购(?!商)|下单|订购|买(?!家))[^，。,.!?！？]{0,8}(?:套餐|积分|点数|额度|付费服务|收费服务)/,
      ],
      title: '付费能力需要你确认',
      body: '这一步可能产生费用或消耗点数。确认前我不会调用付费能力,可以先整理免费资料和待确认清单。',
      confirmLabel: '确认继续',
    },
    {
      type: 'export_file',
      keywords: ['导出', '导出到', '导出文件', '下载', '下载到', '下载文件', '保存到桌面'],
      patterns: [/保存[^，。,.!?！？]{0,16}(?:到)?桌面/, /保存[^，。,.!?！？]{0,16}下载(?:文件)?/],
      title: '导出文件前需要确认',
      body: '这一步会生成可转发文件。确认前请检查是否包含客户隐私、底价或内部策略。',
      confirmLabel: '确认导出',
    },
    {
      type: 'customer_write',
      keywords: ['保存到客户', '写入客户', '存到客户', '更新客户档案', '保存客户摘要', '保存一下', '保存下', '保存这份', '保存当前', '保存起来', '存一下', '存起来'],
      title: '写入客户档案前需要确认',
      body: '这一步会影响客户档案或历史跟进。确认后只保存摘要、依据和下一步,不保存原始敏感资料。',
      confirmLabel: '确认写入',
    },
  ];

  return rules.find((rule) => {
    if (rule.type === 'external_send' && isChannelDraftOnlyRequest(text)) {
      return false;
    }
    const hasKeyword = rule.keywords.some((keyword) => value.includes(keyword));
    const hasPattern = (rule.patterns || []).some((pattern) => pattern.test(value));
    return hasKeyword || hasPattern;
  }) || null;
}

/**
 * isChannelDraftOnlyRequest 判断“WhatsApp / 邮件”等渠道词是不是只在描述草稿版本。
 *
 * 作用：
 * - 用户常会说“把第1天话术写成英文 WhatsApp 和邮件两版”，这只是编辑当前产物。
 * - 这类请求不能因为出现渠道名就被当成外发动作，否则对话会突然停在确认卡。
 * - 真正包含“发给客户 / 发送 / 外发 / 直接发”的句子仍然需要确认。
 *
 * 参数：
 * - text：用户本轮输入文本。
 *
 * 返回值：boolean，true 表示这是渠道草稿或话术版本请求，不是外发动作。
 * 可能抛出的异常：无。
 */
function isChannelDraftOnlyRequest(text = '') {
  const value = String(text).toLowerCase();
  const mentionsChannel = /whatsapp|wa\b|邮件|email|mail|站内信|即时消息/.test(value);
  if (!mentionsChannel) {
    return false;
  }

  const asksForDraftVersion = /话术|文案|草稿|模板|版本|两版|多版|改成|写成|整理成|生成[^，。,.!?！？]{0,8}版|subject|标题/.test(value);
  if (!asksForDraftVersion) {
    return false;
  }

  const explicitSendIntent =
    /外发|直接(?:发|发送)|现在(?:发|发送)|立即(?:发|发送)|马上(?:发|发送)|帮我(?:发|发送)|(?:然后|再|并)?发送(?:给|到)?(?:客户|买家|采购商|客人)?|发出|发(?:送)?给|(?:然后|再|并|直接|现在|立即|马上|帮我)\s*发(?:客户|买家|采购商|客人)|发到|发送到|寄给|send\s+(?:to|email|it|now)|发邮件(?:给|到)/.test(value);
  return !explicitSendIntent;
}

function missingArtifactForRiskyAction(input = {}) {
  const type = input.riskyAction?.type || '';
  const artifact = input.context?.artifact || null;
  if (artifact) {
    return null;
  }

  const requirements = {
    customer_write: ['还没有可保存到客户档案的业务产物', '请先生成客户分析、跟进计划或邮件草稿'],
    export_file: ['还没有可导出的业务产物', '请先生成或选择要导出的文件'],
  };
  const missing = requirements[type];
  return missing ? { missing } : null;
}

/**
 * shouldGenerateArtifactBeforeRiskConfirmation 判断是否可以先做安全产物再等确认。
 *
 * 作用：
 * - 用户常会第一句话就说“生成报价单并导出”,这时导出前确实没有现成 artifact。
 * - 如果同一句话已经匹配到完整业务任务,Agent 应先生成报价单/草稿这类安全产物。
 * - 只有保存到客户档案、导出文件这类“依赖产物”的动作走这个路径。
 * - 外发、付费、调用外部系统仍保持先确认,避免用户误以为已经产生外部副作用。
 *
 * 参数：
 * - input.match：当前文本的业务 Skill 匹配结果。
 * - input.riskyAction：当前文本命中的风险动作。
 *
 * 返回值：boolean，true 表示可先生成安全业务产物,再进入确认等待。
 * 可能抛出的异常：无。
 */
function shouldGenerateArtifactBeforeRiskConfirmation(input = {}) {
  if (!input.match?.matched) {
    return false;
  }
  return ['customer_write', 'export_file'].includes(input.riskyAction?.type || '');
}

function isConfirmationMessage(text = '', pendingConfirmation = {}) {
  const value = normalizeConfirmationText(text);
  if (!value) {
    return false;
  }

  const confirmLabel = normalizeConfirmationText(pendingConfirmation.confirmLabel || '');
  if (confirmLabel && matchesConfirmationCandidate(value, confirmLabel)) {
    return true;
  }

  const candidates = confirmationCandidatesForType(pendingConfirmation.type);
  return candidates.map(normalizeConfirmationText).some((candidate) => matchesConfirmationCandidate(value, candidate));
}

function isCancelMessage(text = '', pendingConfirmation = {}) {
  const value = normalizeConfirmationText(text);
  if (!value) {
    return false;
  }
  const exactCancelTexts = ['取消', '取消这一步', '先不', '先不要', '先不用', '不要', '不用', '先不导出', '先不写入', '不要导出', '不要写入', '停止'];
  return exactCancelTexts.includes(value) ||
    hasNaturalCancelIntent(value, pendingConfirmation);
}

function normalizeConfirmationText(text = '') {
  return String(text || '')
    .replace(/[，。,.!！?？\s]/g, '')
    .trim();
}

/**
 * matchesConfirmationCandidate 判断一句自然回复是否是在确认当前等待动作。
 *
 * 作用：
 * - 继续保留按钮文案的精确匹配，例如“先生成草稿”。
 * - 额外接受自然确认说法，例如“可以，先生成草稿”“好的，确认导出”。
 * - 不用单纯 contains 来判断，避免“先不要生成草稿”被误判成确认。
 *
 * 参数：
 * - value：已经过 normalizeConfirmationText 清洗的用户回复。
 * - candidate：已经过 normalizeConfirmationText 清洗的确认候选词。
 *
 * 返回值：boolean，true 表示可以继续执行当前确认动作。
 * 可能抛出的异常：无。
 */
function matchesConfirmationCandidate(value = '', candidate = '') {
  if (!value || !candidate) {
    return false;
  }
  if (value === candidate) {
    return true;
  }
  return hasNaturalConfirmationPrefix(value) && value.includes(candidate);
}

/**
 * confirmationCandidatesForType 返回每类确认卡允许的明确确认文案。
 *
 * 作用：
 * - isConfirmationMessage 和确认句补充提取共用同一张表。
 * - 避免新增确认类型时一处能确认、另一处却提取不了补充。
 *
 * 参数：
 * - type：pendingConfirmation.type。
 *
 * 返回值：字符串数组,每项是用户可以明确确认当前动作的业务文案。
 * 可能抛出的异常：无。
 */
function confirmationCandidatesForType(type = '') {
  const acceptedByType = {
    customer_write: ['确认写入', '确认保存', '同意写入', '保存到客户档案'],
    export_file: ['确认导出', '确认下载', '导出文件'],
    external_send: ['先生成草稿', '生成草稿', '确认生成草稿'],
    paid_call: ['确认继续', '同意继续', '确认调用'],
    runtime_policy: ['确认继续', '同意继续', '确认调用'],
    risky_action: ['确认继续'],
  };
  return acceptedByType[type] || ['确认继续'];
}

/**
 * hasNaturalConfirmationPrefix 识别自然口语里的确认开头。
 *
 * 作用：
 * - 支持“可以”“好的”“没问题”“ok”等常见确认开头。
 * - 如果句子里已经出现明显否定词，则不把它当成确认，保护取消语义。
 *
 * 参数：
 * - value：已经过 normalizeConfirmationText 清洗的用户回复。
 *
 * 返回值：boolean，true 表示这句话带有自然确认意图。
 * 可能抛出的异常：无。
 */
function hasNaturalConfirmationPrefix(value = '') {
  const lowerValue = String(value || '').toLowerCase();
  if (!lowerValue || hasNegativeConfirmationCue(lowerValue) || hasTentativeConfirmationCue(lowerValue)) {
    return false;
  }
  const prefixes = ['可以的', '可以', '好的', '好', '行的', '行', '同意', '确认', '没问题', 'ok', 'okay', 'yes', 'sure'];
  return prefixes.some((prefix) => lowerValue.startsWith(prefix));
}

/**
 * hasNegativeConfirmationCue 检查确认语里是否夹带了否定含义。
 *
 * 作用：
 * - 防止“好的，不要生成草稿”“好像不用生成草稿”这类话被自然确认前缀误伤。
 *
 * 参数：
 * - value：已转小写的清洗文本。
 *
 * 返回值：boolean，true 表示这句话里存在否定线索。
 * 可能抛出的异常：无。
 */
function hasNegativeConfirmationCue(value = '') {
  return ['不要', '不用', '不需要', '先不要', '先不用', '先别', '别'].some((cue) => value.includes(cue));
}

/**
 * hasTentativeConfirmationCue 识别“还在讨论方案”的试探语。
 *
 * 作用：
 * - 防止“好像先生成草稿更合适”因为 `好` 开头被当成确认。
 * - 这些话应继续停在确认卡,让用户明确说“可以/确认”。
 *
 * 参数：
 * - value：已转小写的清洗文本。
 *
 * 返回值：boolean,true 表示这句话是试探/建议,不是确认。
 * 可能抛出的异常：无。
 */
function hasTentativeConfirmationCue(value = '') {
  return ['好像', '可能', '感觉', '我觉得', '要不', '要么', '也许', 'maybe', 'perhaps'].some((cue) => value.startsWith(cue));
}

/**
 * hasNaturalCancelIntent 判断一句自然回复是否是在取消当前等待动作。
 *
 * 作用：
 * - 支持“先不要生成草稿”“不用发了”这种自然取消话术。
 * - 只在否定词后面跟着当前确认动作相关关键词时取消，避免“不要太正式”这类补充被误取消。
 *
 * 参数：
 * - value：已经过 normalizeConfirmationText 清洗的用户回复。
 * - pendingConfirmation：当前等待确认的动作，用来决定哪些关键词代表“取消这一步”。
 *
 * 返回值：boolean，true 表示取消当前确认动作。
 * 可能抛出的异常：无。
 */
function hasNaturalCancelIntent(value = '', pendingConfirmation = {}) {
  const lowerValue = String(value || '').toLowerCase();
  const negativePrefixes = ['暂时先不要', '暂时不要', '暂时不用', '先不要', '先不用', '先不需要', '先别', '不要', '不用', '不需要', '取消', '别'];
  if (!negativePrefixes.some((prefix) => lowerValue.startsWith(prefix))) {
    return false;
  }

  const actionKeywordsByType = {
    customer_write: ['写入', '保存', '客户档案'],
    export_file: ['导出', '下载', '文件'],
    external_send: ['生成草稿', '发给客户', '发送', '外发', '发了', '发出', '发邮件', '发信'],
    paid_call: ['继续', '调用', '付费', '扣费', '收费'],
    runtime_policy: ['继续', '调用', '付费', '扣费', '收费'],
    risky_action: ['继续', '执行'],
  };
  const keywords = actionKeywordsByType[pendingConfirmation.type] || ['继续', '执行'];
  return keywords.some((keyword) => lowerValue.includes(keyword.toLowerCase()));
}

/**
 * appendInlineConfirmationSupplement 把确认句里的业务补充并入 pendingConfirmation。
 *
 * 作用：
 * - 用户常会一句话里同时确认和补资料,例如“可以,产品是太阳能路灯,先生成草稿”。
 * - Runtime 恢复时只看 pendingConfirmation.originalText + supplements,所以这里必须把补充资料保留下来。
 * - 如果用户只是说“可以,先生成草稿”,不会追加无意义 supplement。
 *
 * 参数：
 * - pendingConfirmation：当前确认卡状态。
 * - text：用户本轮确认文本。
 *
 * 返回值：新的 pendingConfirmation；没有补充时返回原对象。
 * 可能抛出的异常：无。
 */
function appendInlineConfirmationSupplement(pendingConfirmation = {}, text = '') {
  const supplement = extractInlineConfirmationSupplement(text, pendingConfirmation);
  if (!supplement) {
    return pendingConfirmation;
  }
  return {
    ...pendingConfirmation,
    supplements: appendConfirmationSupplement(pendingConfirmation, supplement),
  };
}

/**
 * extractInlineConfirmationSupplement 从“确认 + 补资料”混合句里剥出补资料部分。
 *
 * 作用：
 * - 去掉自然确认前缀,例如“可以/好的/ok”。
 * - 去掉当前确认动作文案,例如“先生成草稿/确认导出”。
 * - 剩下的业务事实作为 supplement,例如“产品是太阳能路灯”。
 *
 * 参数：
 * - text：用户原始确认文本。
 * - pendingConfirmation：当前确认卡,用于取确认按钮和候选确认文案。
 *
 * 返回值：补充资料文本；没有可用补充时返回空字符串。
 * 可能抛出的异常：无。
 */
function extractInlineConfirmationSupplement(text = '', pendingConfirmation = {}) {
  let supplement = String(text || '').trim();
  if (!supplement) {
    return '';
  }

  supplement = supplement.replace(/^(可以的|可以|好的|好|行的|行|同意|确认|没问题|ok|okay|yes|sure)[，。,.!！?？\s]*/i, '');
  const candidates = [
    pendingConfirmation.confirmLabel,
    ...confirmationCandidatesForType(pendingConfirmation.type),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const pattern = new RegExp(escapeRegExp(String(candidate).trim()), 'gi');
    supplement = supplement.replace(pattern, '');
  }

  return supplement
    .replace(/[，。,.!！?？\s]+$/g, '')
    .replace(/^[，。,.!！?？\s]+/g, '')
    .trim();
}

/**
 * escapeRegExp 转义字符串,让它可以安全塞进 RegExp。
 *
 * 作用：确认按钮文案可能含有正则特殊字符,必须按普通文本匹配。
 *
 * 参数：
 * - value：待转义字符串。
 *
 * 返回值：转义后的字符串。
 * 可能抛出的异常：无。
 */
function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function buildRiskConfirmationResponse(input = {}) {
  const context = input.context || {};
  const sessionId = input.sessionId || createAgentSessionId();
  const confirmation = buildRiskConfirmationObject({
    riskyAction: input.riskyAction,
    text: input.text,
  });
  const progress = buildRiskConfirmationProgressItems({ confirmation });
  await emitRiskConfirmationProgress(input.onRuntimeEvent, { confirmation });

  return {
    ok: true,
    kind: 'confirmation-required',
    sessionId,
    status: 'waiting',
    taskTitle: confirmation.title || '这一步需要你确认',
    progress,
    context: {
      ...context,
      pendingConfirmation: confirmation,
    },
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        content: '我先停一下,这一步需要你确认后再继续。',
        createdAt: new Date().toISOString(),
        confirmation,
        process: {
          expanded: false,
          steps: progress,
          title: `${confirmation.title || '这一步'}处理过程`,
        },
      },
    ],
  };
}

/**
 * buildRiskConfirmationObject 生成统一的风险确认对象。
 *
 * 作用：
 * - 普通风险动作和“先生成产物再确认保存/导出”的路径共用同一种 confirmation 结构。
 * - 避免确认标题、按钮文案和 originalText 在多个分支里写散。
 *
 * 参数：
 * - input.riskyAction：detectRiskyAction 命中的风险动作规则。
 * - input.text：需要确认的完整业务目标文本。
 *
 * 返回值：前端 confirmation 卡片可直接渲染的对象。
 * 可能抛出的异常：无。
 */
function buildRiskConfirmationObject(input = {}) {
  const riskyAction = input.riskyAction || {};
  return {
    type: riskyAction.type || 'risky_action',
    title: riskyAction.title || '这一步需要你确认',
    body: riskyAction.body || '这一步可能影响客户资料、费用或外部系统,需要你确认后我再继续。',
    confirmLabel: riskyAction.confirmLabel || '确认继续',
    cancelLabel: '取消这一步',
    originalText: input.text || '',
  };
}

/**
 * buildPostArtifactRiskConfirmationResponse 把已生成产物的响应转成等待确认态。
 *
 * 作用：
 * - 用户在补齐资料时顺手说“保存/导出”,Agent 先完成安全的草稿生成。
 * - 生成后只暂停有副作用的保存/导出动作,让前端继续展示产物和确认卡。
 *
 * 参数：
 * - input.response：runMatchedSkillGoal 生成的业务产物响应。
 * - input.riskyAction：本轮命中的保存、导出等风险动作。
 * - input.text：恢复 pending task 后得到的完整业务目标。
 * - input.onRuntimeEvent：可选流式事件回调。
 *
 * 返回值：kind 为 confirmation-required 的响应对象。
 * 可能抛出的异常：onRuntimeEvent 内部异常会向上抛出,由 HTTP 层处理。
 */
async function buildPostArtifactRiskConfirmationResponse(input = {}) {
  const response = input.response || {};
  const confirmation = buildRiskConfirmationObject({
    riskyAction: input.riskyAction,
    text: input.text,
  });
  const permissionStep = {
    detail: `${confirmation.title}。确认前不会保存、导出或外发。`,
    label: '核对权限',
    status: 'complete',
  };
  const waitingStep = {
    detail: '等待你确认后再继续,取消则不会执行这一步。',
    label: '等待确认',
    status: 'waiting',
  };
  const progress = [...(Array.isArray(response.progress) ? response.progress : []), permissionStep, waitingStep];
  const confirmLine = confirmation.type === 'customer_write'
    ? '保存前需要你确认。'
    : confirmation.type === 'export_file'
      ? '导出前需要你确认。'
      : '这一步需要你确认。';
  const messages = (response.messages || []).map((message) => {
    if (message.role !== 'assistant') {
      return message;
    }
    return {
      ...message,
      activity: message.activity
        ? {
            ...message.activity,
            items: buildActivityItemsFromProgress(progress),
            source: 'post-artifact-confirmation',
          }
        : message.activity,
      confirmation,
      content: `${message.content}\n${confirmLine}`,
      process: message.process
        ? { ...message.process, steps: progress }
        : {
            expanded: false,
            steps: progress,
            title: `${response.taskTitle || '外贸任务'}执行过程`,
          },
    };
  });

  await emitPostArtifactRiskConfirmationProgress(input.onRuntimeEvent, {
    confirmation,
    runtimeEvents: input.runtimeEvents,
  });

  return {
    ...response,
    kind: 'confirmation-required',
    status: 'waiting',
    progress,
    summary: `${response.summary || '业务材料已生成。'}\n${confirmLine}`,
    context: {
      ...(response.context || {}),
      ...(response.artifact ? { artifact: response.artifact } : {}),
      pendingConfirmation: confirmation,
    },
    messages,
  };
}

/**
 * buildActivityItemsFromProgress 把公开业务进度转成前台「本次操作记录」项。
 *
 * 作用：
 * - 新对话前台优先渲染 message.activity,其次才渲染 message.process。
 * - 当已生成产物后又进入保存/导出确认时,必须让 activity 和 process 使用同一条业务时间线。
 * - 这样用户回看时也能看到第二次「核对权限」,不会看到旧 Runtime 的「完成」尾巴。
 *
 * 参数：
 * - progress：已经净化过的业务进度数组,每项包含 label/detail/status。
 *
 * 返回值：activity.items 数组,字段为前台 ActivityStream 可直接渲染的 kind/title/detail/status。
 * 可能抛出的异常：无。
 */
function buildActivityItemsFromProgress(progress = []) {
  return (Array.isArray(progress) ? progress : []).map((item) => ({
    detail: item.detail || '',
    kind: activityKindForProgressLabel(item.label),
    status: item.status || 'complete',
    title: item.label || '处理进度',
  }));
}

/**
 * activityKindForProgressLabel 为业务进度选择前台活动流的短分类。
 *
 * 作用：
 * - ActivityStream 会把 kind 渲染成「识别 / 判断 / 计划 / 处理 / 检查」这类短标签。
 * - 这里不暴露 Runtime action 名,只按用户看得懂的业务 label 映射。
 *
 * 参数：
 * - label：业务进度标题。
 *
 * 返回值：ActivityStream 支持的 kind 字符串。
 * 可能抛出的异常：无。
 */
function activityKindForProgressLabel(label = '') {
  if (label === '识别任务') {
    return 'goal';
  }
  if (label === '确认任务类型' || label === '核对权限') {
    return 'thought';
  }
  if (label === '拆解任务') {
    return 'plan';
  }
  if (label === '整理发现' || label === '检查结果' || label === '等待确认') {
    return 'observation';
  }
  return 'action';
}

/**
 * emitBufferedRuntimeEvents 回放临时缓冲的 Runtime 事件。
 *
 * 作用：
 * - 某些分支需要先看 Runtime 是否生成了产物,再决定公开进度如何收尾。
 * - 如果最后不需要改写成确认等待态,就把缓冲事件原样回放给 SSE。
 *
 * 参数：
 * - onRuntimeEvent：外层 SSE 事件回调,可为空。
 * - events：缓冲的 Runtime 事件数组。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：onRuntimeEvent 内部异常会向上抛出。
 */
async function emitBufferedRuntimeEvents(onRuntimeEvent, events = []) {
  if (!onRuntimeEvent) {
    return;
  }
  for (const event of events) {
    await onRuntimeEvent(event);
  }
}

/**
 * emitPostArtifactRiskConfirmationProgress 回放“先生成产物,再等确认”的进度。
 *
 * 作用：
 * - 用户补齐资料并顺手要求保存/导出时,Runtime 会先完成安全产物生成。
 * - 前台最终状态应是“等待确认”,不能先显示 `完成` 再突然显示确认卡。
 * - 因此回放生成材料相关事件时过滤 `run.completed`,再补 `policy.checked / run.waiting`。
 *
 * 参数：
 * - onRuntimeEvent：外层 SSE 事件回调,可为空。
 * - input.confirmation：保存/导出确认对象。
 * - input.runtimeEvents：Runtime 生成产物时缓冲的事件。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：onRuntimeEvent 内部异常会向上抛出。
 */
async function emitPostArtifactRiskConfirmationProgress(onRuntimeEvent, input = {}) {
  if (!onRuntimeEvent) {
    return;
  }
  const confirmation = input.confirmation || {};
  const runtimeEvents = Array.isArray(input.runtimeEvents) ? input.runtimeEvents : [];
  for (const event of runtimeEvents) {
    if (event?.type === 'run.completed') {
      continue;
    }
    await onRuntimeEvent(event);
  }
  await onRuntimeEvent({
    action: confirmation.type || 'risky_action',
    decision: 'ask',
    source: 'agent-risk-confirmation',
    status: 'complete',
    type: 'policy.checked',
  });
  await onRuntimeEvent({
    reason: confirmation.title || '这一步需要你确认',
    source: 'agent-risk-confirmation',
    status: 'waiting',
    type: 'run.waiting',
  });
}

async function buildConfirmationSupplementResponse(input = {}) {
  const pendingConfirmation = input.pendingConfirmation || {};
  const supplement = String(input.text || '').trim();
  const confirmation = {
    ...pendingConfirmation,
    supplements: appendConfirmationSupplement(pendingConfirmation, supplement),
  };
  const progress = buildRiskConfirmationProgressItems({ confirmation });
  await emitRiskConfirmationProgress(input.onRuntimeEvent, { confirmation });

  return {
    ok: true,
    kind: 'confirmation-required',
    sessionId: input.sessionId || createAgentSessionId(),
    status: 'waiting',
    progress,
    context: {
      ...(input.context || {}),
      pendingConfirmation: confirmation,
    },
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        content: [
          supplement ? `已记录这句补充: ${supplement}` : '已回到这次待确认任务。',
          `但「${confirmation.title || '这一步'}」仍需要你确认后我才会继续。`,
          '你可以确认继续,也可以取消这一步。',
        ].join('\n'),
        createdAt: new Date().toISOString(),
        confirmation,
        process: {
          expanded: false,
          steps: progress,
          title: `${confirmation.title || '待确认动作'}处理过程`,
        },
      },
    ],
  };
}

function appendConfirmationSupplement(pendingConfirmation = {}, text = '') {
  const cleanText = String(text || '').trim();
  const existing = Array.isArray(pendingConfirmation.supplements)
    ? pendingConfirmation.supplements.filter(Boolean)
    : [];
  if (!cleanText || existing.includes(cleanText)) {
    return existing;
  }
  return [...existing, cleanText];
}

function shouldKeepConfirmationWaitingForSupplement(pendingConfirmation = {}) {
  return ['external_send', 'paid_call', 'runtime_policy', 'risky_action'].includes(pendingConfirmation.type);
}

/**
 * buildRiskConfirmationProgressItems 为确认卡生成可见处理过程。
 *
 * 作用：
 * - 风险动作虽然会暂停,但仍要像 agent thread 一样说明“识别了什么、为什么停下”。
 * - 返回值只包含前台业务语言,不暴露 policy/action 等内部名。
 *
 * 参数：
 * - input.confirmation：确认卡对象。
 *
 * 返回值：前端 progress/process 可直接渲染的步骤数组。
 * 可能抛出的异常：无。
 */
function buildRiskConfirmationProgressItems(input = {}) {
  const confirmation = input.confirmation || {};
  const title = confirmation.title || '这一步';

  return [
    {
      detail: '已识别这次请求里包含需要确认的动作。',
      label: '识别任务',
      status: 'complete',
    },
    {
      detail: `${title}。我会先停下来,不自动执行。`,
      label: '核对权限',
      status: 'complete',
    },
    {
      detail: '等待你确认后再继续,取消则不会执行这一步。',
      label: '等待确认',
      status: 'waiting',
    },
  ];
}

/**
 * emitRiskConfirmationProgress 把风险确认路径写成流式进度事件。
 *
 * 作用：
 * - `/api/agent/message/stream` 在确认卡出现前也能看到实时步骤。
 * - 事件类型复用已有业务化翻译,避免前台理解内部确认逻辑。
 *
 * 参数：
 * - onRuntimeEvent：流式事件回调,可为空。
 * - input.confirmation：确认卡对象。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：onRuntimeEvent 内部异常会向上抛出,由 HTTP 层处理。
 */
async function emitRiskConfirmationProgress(onRuntimeEvent, input = {}) {
  if (!onRuntimeEvent) {
    return;
  }
  const confirmation = input.confirmation || {};
  await onRuntimeEvent({
    source: 'agent-risk-confirmation',
    status: 'complete',
    type: 'goal.received',
  });
  await onRuntimeEvent({
    action: confirmation.type || 'risky_action',
    decision: 'ask',
    source: 'agent-risk-confirmation',
    status: 'complete',
    type: 'policy.checked',
  });
  await onRuntimeEvent({
    reason: confirmation.title || '这一步需要你确认',
    source: 'agent-risk-confirmation',
    status: 'waiting',
    type: 'run.waiting',
  });
}

async function buildConfirmationAcceptedResponse(input = {}) {
  const pendingConfirmation = input.pendingConfirmation || {};
  if (pendingConfirmation.type === 'runtime_policy' && pendingConfirmation.runtime?.runId) {
    const runtime =
      input.skillRuntime ||
      createSkillRuntime({
        checkPolicy: input.checkPolicy,
        onEvent: input.onRuntimeEvent,
        projectRoot: input.projectRoot,
      });
    const result = await runtime.resumeGoal({ runId: pendingConfirmation.runtime.runId });
    if (result.ok === false) {
      return {
        ok: false,
        error: result.error || 'RUNTIME_RESUME_FAILED',
        message: '已收到确认,但任务续跑卡住了。我没有继续执行风险动作,需要检查 Runtime checkpoint 后再处理。',
        loop: result.loop,
        runId: result.runId,
      };
    }
    const response = buildSkillAgentResponse({
      result,
      sessionId: input.sessionId,
      userText: pendingConfirmation.originalText || '',
    });

    return {
      ...response,
      kind: response.kind === 'confirmation-required' ? response.kind : 'confirmation-accepted',
      messages: response.messages.map((message) => {
        if (message.role !== 'assistant') {
          return message;
        }
        return {
          ...message,
          content: `已确认,我会从刚才暂停的位置继续。\n${message.content}`,
        };
      }),
    };
  }

  if (pendingConfirmation.type === 'paid_call') {
    const taskText = buildTaskTextFromConfirmation(pendingConfirmation);
    const taskMatch = input.registry ? matchSkillForGoal({ registry: input.registry, text: taskText }) : { matched: false };
    if (taskMatch.matched) {
      const missingContext = detectMissingBusinessContext({ match: taskMatch, text: taskText });
      if (missingContext.missing.length > 0) {
        const response = await buildNeedsInputResponse({
          matchedSkill: taskMatch.skill,
          missing: missingContext.missing,
          onRuntimeEvent: input.onRuntimeEvent,
          projectRoot: input.projectRoot,
          sessionId: input.sessionId,
          text: taskText,
        });
        return {
          ...response,
          messages: response.messages.map((message) => ({
            ...message,
            content: `已确认。我先接着这次任务整理不扣费的部分;如果后面真的要产生费用,会再让你看清楚并确认。\n${message.content}`,
          })),
        };
      }
    }

    if (!taskMatch.matched) {
      const response = await buildNeedsInputResponse({
        onRuntimeEvent: input.onRuntimeEvent,
        projectRoot: input.projectRoot,
        sessionId: input.sessionId,
        text: taskText,
      });
      return {
        ...response,
        messages: response.messages.map((message) => ({
          ...message,
          content: `已确认。我先不调用付费能力,需要先明确业务任务和资料。\n${message.content}`,
        })),
      };
    }

    const runtime =
      input.skillRuntime ||
      createSkillRuntime({
        checkPolicy: input.checkPolicy,
        onEvent: input.onRuntimeEvent,
        projectRoot: input.projectRoot,
      });
    const result = await runtime.runGoal({ text: taskText });
    if (result.ok === false) {
      return {
        ok: false,
        error: result.error || 'PAID_CONFIRMATION_CONTINUATION_FAILED',
        message: '已收到确认,但任务续跑卡住了。我没有继续调用付费能力,可以补充客户、产品或目标后再继续。',
        loop: result.loop,
        runId: result.runId,
      };
    }
    const response = buildSkillAgentResponse({
      result,
      sessionId: input.sessionId,
      userText: pendingConfirmation.originalText || taskText,
    });

    return {
      ...response,
      kind: response.kind === 'confirmation-required' ? response.kind : 'confirmation-accepted',
      messages: response.messages.map((message) => {
        if (message.role !== 'assistant') {
          return message;
        }
        return {
          ...message,
          content: `已确认。我先接着这次任务整理不扣费的部分;如果后面真的要产生费用,会再让你看清楚并确认。\n${message.content}`,
        };
      }),
    };
  }

  if (pendingConfirmation.type === 'external_send') {
    const draftText = buildDraftTextFromConfirmation(pendingConfirmation);
    const continuationText = buildTaskTextFromConfirmation(pendingConfirmation) || draftText;
    const contextWithoutPendingConfirmation = clearPendingConfirmation(input.context);
    if (shouldHandleAsCurrentArtifactFollowup({
      context: contextWithoutPendingConfirmation,
      session: input.session,
      sessionId: input.sessionId,
      startsFreshTask: false,
      text: continuationText,
    })) {
      const response = await buildAgentFollowupResponse({
        context: contextWithoutPendingConfirmation,
        onRuntimeEvent: input.onRuntimeEvent,
        projectRoot: input.projectRoot,
        session: input.session,
        sessionId: input.sessionId,
        text: continuationText,
      });
      const responseContext = clearPendingConfirmation(response.context);

      return {
        ...response,
        kind: response.kind === 'followup' ? 'confirmation-accepted' : response.kind,
        context: responseContext,
        messages: response.messages.map((message) => {
          if (message.role !== 'assistant') {
            return message;
          }
          return {
            ...message,
            content: `已确认,我只生成可检查草稿,不会自动外发。\n${message.content}`,
          };
        }),
      };
    }
    const draftMatch = input.registry ? matchSkillForGoal({ registry: input.registry, text: draftText }) : { matched: false };
    if (draftMatch.matched) {
      const missingContext = detectMissingBusinessContext({ match: draftMatch, text: draftText });
      if (missingContext.missing.length > 0) {
        const response = await buildNeedsInputResponse({
          matchedSkill: draftMatch.skill,
          missing: missingContext.missing,
          onRuntimeEvent: input.onRuntimeEvent,
          projectRoot: input.projectRoot,
          sessionId: input.sessionId,
          text: draftText,
        });
        return {
          ...response,
          context: {
            ...response.context,
          },
          messages: response.messages.map((message) => ({
            ...message,
            content: `已确认,我只生成可检查草稿,不会自动外发。\n${message.content}`,
          })),
        };
      }
    }
    const runtime =
      input.skillRuntime ||
      createSkillRuntime({
        checkPolicy: input.checkPolicy,
        onEvent: input.onRuntimeEvent,
        projectRoot: input.projectRoot,
      });
    const result = await runtime.runGoal({ text: draftText });
    if (result.ok === false) {
      return {
        ok: false,
        error: result.error || 'CONFIRMATION_CONTINUATION_FAILED',
        message: '已收到确认,但草稿生成卡住了。我没有外发任何内容,需要补充客户、产品或邮件目标后再继续。',
        loop: result.loop,
        runId: result.runId,
      };
    }
    const response = buildSkillAgentResponse({
      result,
      sessionId: input.sessionId,
      userText: pendingConfirmation.originalText || draftText,
    });

    return {
      ...response,
      kind: 'confirmation-accepted',
      context: {
        artifact: response.artifact,
        period: response.period,
      },
      messages: response.messages.map((message) => {
        if (message.role !== 'assistant') {
          return message;
        }
        return {
          ...message,
          content: `已确认,我只生成可检查草稿,不会自动外发。\n${message.content}`,
        };
      }),
    };
  }

  if (pendingConfirmation.type === 'export_file') {
    const exported = await exportAgentArtifact({
      projectRoot: input.projectRoot,
      session: input.session || { context: input.context || {} },
      sessionId: input.sessionId,
    });
    const now = new Date().toISOString();
    const artifact = exported.artifact;
    const summary = `已确认导出。${exported.message}`;

    return {
      ok: true,
      kind: 'confirmation-accepted',
      sessionId: input.sessionId || createAgentSessionId(),
      status: 'completed',
      summary,
      artifact,
      context: { artifact },
      messages: [
        {
          id: messageId('assistant'),
          role: 'assistant',
          content: `${summary}\n导出前没有外发、没有写入客户档案,也没有调用付费能力。`,
          createdAt: now,
          artifact,
        },
      ],
    };
  }

  if (pendingConfirmation.type === 'customer_write') {
    const saved = await saveAgentArtifactToCustomerMemory({
      projectRoot: input.projectRoot,
      session: input.session || { context: input.context || {} },
      sessionId: input.sessionId,
    });
    const now = new Date().toISOString();
    const summary = `已确认保存。${saved.message}。`;
    const { pendingConfirmation: _clearedPendingConfirmation, ...confirmedContext } = input.context || {};
    const taskTitle = resolveFollowupTaskTitle({
      artifactName: confirmedContext.artifact?.name || confirmedContext.artifact?.workbookName || '',
      context: confirmedContext,
      session: input.session,
    });
    const artifact = confirmedContext.artifact || input.session?.context?.artifact;

    return {
      ok: true,
      kind: 'confirmation-accepted',
      sessionId: input.sessionId || createAgentSessionId(),
      status: 'completed',
      taskTitle,
      summary,
      ...(artifact ? { artifact } : {}),
      context: {
        ...confirmedContext,
        customerSlug: saved.customerSlug,
        lastCustomerSave: {
          customerSlug: saved.customerSlug,
          diaryPath: saved.diaryPath,
          memoryPath: saved.memoryPath,
          savedSummary: saved.savedSummary,
        },
      },
      messages: [
        {
          id: messageId('assistant'),
          role: 'assistant',
          content: [
            summary,
            `保存摘要: ${saved.savedSummary}`,
            '我只保存摘要、依据和下一步,没有外发内容,也没有调用付费能力。',
          ].join('\n'),
          createdAt: now,
          ...(artifact ? { artifact } : {}),
        },
      ],
    };
  }

  const nextLine = pendingConfirmation.type === 'external_send'
    ? '我会先生成可检查的草稿,不会自动外发。'
    : pendingConfirmation.type === 'paid_call'
      ? '我会先整理不扣费的部分;如果后面真的要产生费用,会再让你看清楚并确认。'
      : '我会接着这次任务继续处理,并保留这次确认记录。';

  return {
    ok: true,
    kind: 'confirmation-accepted',
    sessionId: input.sessionId || createAgentSessionId(),
    status: 'completed',
    context: {},
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        content: `已确认。\n${nextLine}`,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

/**
 * clearPendingConfirmation 从上下文里移除等待确认状态。
 *
 * 作用：
 * - 用户确认“只生成草稿”后,线程应该回到可继续工作的业务上下文。
 * - 不能把旧 pendingConfirmation 继续带回前端,否则下一句话会再次被当成同一个确认卡的补充。
 *
 * 参数：
 * - context：当前线程上下文对象,可能包含 artifact、period、pendingTask、pendingConfirmation。
 *
 * 返回值：新的上下文对象；保留业务上下文,只删除 pendingConfirmation。
 * 可能抛出的异常：无。
 */
function clearPendingConfirmation(context = {}) {
  const { pendingConfirmation: _pendingConfirmation, ...contextWithoutPendingConfirmation } = context || {};
  return contextWithoutPendingConfirmation;
}

function buildTaskTextFromConfirmation(pendingConfirmation = {}) {
  const originalText = String(pendingConfirmation.originalText || '').trim();
  const supplements = Array.isArray(pendingConfirmation.supplements)
    ? pendingConfirmation.supplements.filter(Boolean).join('；补充资料: ')
    : '';
  return [originalText, supplements].filter(Boolean).join('；补充资料: ') || originalText;
}

function buildDraftTextFromConfirmation(pendingConfirmation = {}) {
  const originalText = String(pendingConfirmation.originalText || '').trim();
  const supplements = Array.isArray(pendingConfirmation.supplements)
    ? pendingConfirmation.supplements.filter(Boolean).join('；补充资料: ')
    : '';
  const fullText = [originalText, supplements].filter(Boolean).join('；补充资料: ');
  if (/询盘|回复|回信|客户问|客户发来|帮我回|回一下/i.test(fullText)) {
    return `帮我准备一封询盘回复草稿。原始需求: ${fullText}`;
  }
  if (/邮件|开发信|follow\s*up|email/i.test(fullText)) {
    return `帮我准备一封跟进开发信。原始需求: ${fullText}`;
  }
  return `帮我准备一封跟进开发信。原始需求: ${fullText || originalText}`;
}

function buildRuntimePolicyConfirmation(input = {}) {
  const result = input.result || {};
  const waiting = result.waiting || {};
  const action = waiting.action || '';
  const templates = {
    'customer.write_memory': {
      title: '写入客户档案前需要确认',
      body: '这一步会影响客户档案或历史跟进。确认后我会从暂停位置继续,只保存必要摘要和依据。',
      confirmLabel: '确认写入',
    },
    'artifact.export_file': {
      title: '导出文件前需要确认',
      body: '这一步会生成可转发文件。确认前请检查是否包含客户隐私、底价或内部策略。',
      confirmLabel: '确认导出',
    },
    'paid_api.call': {
      title: '付费能力需要你确认',
      body: '这一步可能产生费用或消耗点数。确认前我不会调用付费能力。',
      confirmLabel: '确认继续',
    },
  };
  const template = templates[action] || {
    title: '这一步需要你确认',
    body: waiting.reason || '这一步可能影响客户资料、费用或外部系统,需要你确认后我再继续。',
    confirmLabel: '确认继续',
  };

  return {
    type: 'runtime_policy',
    title: template.title,
    body: template.body,
    confirmLabel: template.confirmLabel,
    cancelLabel: '取消这一步',
    originalText: input.userText || '',
    runtime: {
      action,
      checkpointPath: waiting.checkpointPath,
      resumeFrom: waiting.resumeFrom,
      runId: waiting.runId || result.runId,
    },
  };
}

function buildConfirmationCancelledResponse(input = {}) {
  const pendingConfirmation = input.pendingConfirmation || {};
  const label = pendingConfirmation.title || '这一步';
  const { pendingConfirmation: _cancelledPendingConfirmation, ...contextWithoutPendingConfirmation } = input.context || {};
  return {
    ok: true,
    kind: 'confirmation-cancelled',
    sessionId: input.sessionId || createAgentSessionId(),
    status: 'waiting',
    context: contextWithoutPendingConfirmation,
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        content: `已取消「${label}」。我会留在当前任务里,不保存、不导出、不外发,也不会调用付费能力。你可以继续补充或调整这次材料。`,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

/**
 * buildNeedsInputResponse 在新对话没有匹配到可执行任务时,返回继续追问而不是报错。
 *
 * 作用：
 * - 让「新对话」更像 Codex / Claude Code:不确定时问清楚,而不是抛一个技术错误。
 * - 明确当前还缺什么资料,避免模型在没有依据时硬编。
 *
 * 参数：
 * - input.text：用户刚输入的任务目标,字符串。
 *
 * 返回值：前端可直接追加到任务线程的响应对象。
 * 可能抛出的异常：无。
 */
async function buildNeedsInputResponse(input = {}) {
  const userText = String(input.text || '').trim();
  const sessionId = input.sessionId || createAgentSessionId();
  const skill = input.matchedSkill || null;
  const missing = Array.isArray(input.missing) && input.missing.length > 0
    ? input.missing
    : ['客户名称', '询盘原文', '产品资料', '目标市场', '价格底线', '希望产出的材料类型'];
  const pendingTask = {
    ...(skill ? { skillId: skill.id, skillName: skill.displayName || skill.id } : {}),
    originalText: userText,
    missing,
    supplements: [],
  };
  const runtime = await writeNeedsInputRuntimeCheckpoint({
    missing,
    projectRoot: input.projectRoot,
    sessionId,
    skill,
    text: userText,
  });
  pendingTask.runtime = runtime;
  const ask = [
    userText ? `我理解你想处理「${userText}」。` : '我还没拿到明确的任务目标。',
    skill ? `这看起来适合按「${skill.displayName || skill.id}」处理。` : '',
    '这件事我需要更多业务资料才能继续,否则容易给出空泛判断。',
    `请先补充: ${missing.join('、')}。`,
    '也可以直接贴客户询盘、产品资料或你希望我产出的格式。',
    '如果你要先跑一个已接好的任务,可以直接说: 帮我开上周询盘分析会 / 帮我准备一封跟进开发信 / 帮我分析这个客户下一步怎么推进。',
  ].filter(Boolean).join('\n');
  const progress = buildNeedsInputProgressItems({ missing, skill });
  const needsInput = buildNeedsInputCard({ missing, skill });
  await emitNeedsInputProgress(input.onRuntimeEvent, { missing });

  return {
    ok: true,
    kind: 'needs-input',
    sessionId,
    status: 'waiting',
    taskTitle: skill?.displayName || '本次外贸任务',
    progress,
    context: { pendingTask },
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        content: ask,
        createdAt: new Date().toISOString(),
        needsInput,
        process: {
          expanded: false,
          steps: progress,
          title: `${skill?.displayName || '外贸任务'}需要补充资料`,
        },
      },
    ],
  };
}

async function buildNeedsInputContinuationResponse(input = {}) {
  const context = input.context || {};
  const pendingTask = context.pendingTask || {};
  const text = String(input.text || '').trim();
  const originalText = pendingTask.originalText || '刚才这件事';
  const missing = input.missing || pendingTask.missing || ['客户名称', '产品资料', '询盘原文或当前目标'];
  const content = [
    `收到,我会把这句补充并入「${originalText}」。`,
    text ? `本次新增资料: ${text}` : '',
    `还需要再补充: ${missing.join('、')}。`,
  ].filter(Boolean).join('\n');
  const progress = buildNeedsInputProgressItems({ missing, skill: input.skill });
  const needsInput = buildNeedsInputCard({ missing, skill: input.skill || { displayName: pendingTask.skillName } });
  await emitNeedsInputProgress(input.onRuntimeEvent, { missing });

  return {
    ok: true,
    kind: 'needs-input-followup',
    sessionId: input.sessionId || createAgentSessionId(),
    status: 'waiting',
    taskTitle: input.skill?.displayName || pendingTask.skillName || '本次外贸任务',
    progress,
    context: {
      pendingTask: {
        ...pendingTask,
        supplements: appendPendingTaskSupplement(pendingTask, text),
        lastSupplement: text,
      },
    },
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
        needsInput,
        process: {
          expanded: false,
          steps: progress,
          title: `${input.skill?.displayName || pendingTask.skillName || '外贸任务'}需要补充资料`,
        },
      },
    ],
  };
}

/**
 * buildNeedsInputCard 把缺失资料转成前台可直接渲染的清单卡片。
 *
 * 作用：
 * - 让新对话等待态像 agent thread 一样明确列出“现在缺什么”。
 * - 避免用户从一大段文字里找资料项,也避免前台展示 schema、skillId 或内部字段。
 *
 * 参数：
 * - input.missing：缺失资料清单,字符串数组。
 * - input.skill：可选 Skill 信息,只读取 displayName 作为用户可见任务名。
 *
 * 返回值：包含 title、items 和 hint 的对象。
 * 可能抛出的异常：无。
 */
function buildNeedsInputCard(input = {}) {
  const missing = Array.isArray(input.missing) && input.missing.length > 0
    ? input.missing
    : ['关键业务资料'];
  const skillName = input.skill?.displayName || '外贸任务';

  return {
    title: `${skillName}需要补充资料`,
    items: missing,
    hint: '直接补一句话即可,我会接着这次任务继续。',
  };
}

function buildNeedsInputProgressItems(input = {}) {
  const missing = Array.isArray(input.missing) && input.missing.length > 0
    ? input.missing
    : ['关键业务资料'];
  const skillName = input.skill?.displayName || '这次任务';

  return [
    {
      detail: `已理解你要处理「${skillName}」。`,
      label: '识别任务',
      status: 'complete',
    },
    {
      detail: `已核对 ${skillName} 需要的业务资料。`,
      label: '核对资料',
      status: 'complete',
    },
    {
      detail: `还缺: ${missing.join('、')}。请补充后我再继续。`,
      label: '等待补充',
      status: 'waiting',
    },
  ];
}

function appendPendingTaskSupplement(pendingTask = {}, text = '') {
  const cleanText = String(text || '').trim();
  const existing = Array.isArray(pendingTask.supplements)
    ? pendingTask.supplements.filter(Boolean)
    : [pendingTask.lastSupplement].filter(Boolean);
  if (!cleanText || existing.includes(cleanText)) {
    return existing;
  }
  return [...existing, cleanText];
}

/**
 * writeNeedsInputRuntimeCheckpoint 为缺资料等待写入 Runtime 风格 checkpoint。
 *
 * 作用：
 * - 让 needs-input 和 policy ask 一样有 run log / checkpoint 硬证据。
 * - 用户补一句话后可以用同一个 runId 记录 `run.resumed` 和后续执行事件。
 * - 前台仍只展示业务清单,不展示 runId、路径或 JSON。
 *
 * 参数：
 * - input.projectRoot：项目根目录。
 * - input.text：原始用户目标。
 * - input.skill：已匹配到的 Skill,可为空。
 * - input.missing：缺失资料清单。
 * - input.sessionId：当前 agent thread id。
 *
 * 返回值：pendingTask 内部 runtime 摘要。
 * 可能抛出的异常：文件系统写入失败时抛出。
 */
async function writeNeedsInputRuntimeCheckpoint(input = {}) {
  const projectRoot = input.projectRoot || process.cwd();
  const runId = generateRuntimeRunId('skill-runtime');
  const workbenchRunsRoot = path.join(projectRoot, 'workbench', 'runs');
  const runLogPath = path.join(workbenchRunsRoot, `${runId}.jsonl`);
  const checkpointPath = path.join(workbenchRunsRoot, `${runId}.checkpoint.json`);
  const skill = input.skill || {};
  const skillId = skill.id || '';
  const missing = Array.isArray(input.missing) ? input.missing : [];
  const resumeFrom = `needs-input:${skillId || 'unmatched'}`;
  const checkpoint = {
    createdAt: new Date().toISOString(),
    missing,
    originalText: String(input.text || ''),
    resume_from: resumeFrom,
    runId,
    sessionId: input.sessionId || '',
    skillId,
    skillName: skill.displayName || skillId || '',
    status: 'waiting',
  };

  await mkdir(workbenchRunsRoot, { recursive: true });
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  await appendRuntimeRunEvent(runLogPath, {
    runId,
    status: 'complete',
    text: summarizeRuntimeText(input.text),
    type: 'goal.received',
  });
  if (skillId) {
    await appendRuntimeRunEvent(runLogPath, {
      runId,
      skillId,
      status: 'complete',
      type: 'skill.matched',
    });
    await appendRuntimeRunEvent(runLogPath, {
      runId,
      requiredFiles: ['skill.json'],
      skillId,
      status: 'complete',
      type: 'skill.loaded',
    });
  }
  await appendRuntimeRunEvent(runLogPath, {
    checkpoint: path.relative(path.join(projectRoot, 'workbench'), checkpointPath),
    resume_from: resumeFrom,
    runId,
    status: 'waiting',
    type: 'run.checkpointed',
  });
  await appendRuntimeRunEvent(runLogPath, {
    missing,
    reason: '关键业务资料不足,暂停等待用户补充。',
    resume_from: resumeFrom,
    runId,
    status: 'waiting',
    type: 'run.needs_input',
  });

  return {
    checkpointPath,
    resumeFrom,
    runId,
    runLogPath,
  };
}

/**
 * appendRuntimeRunEvent 写入一条 Runtime JSONL 事件。
 *
 * 参数：
 * - runLogPath：run log 文件路径。
 * - event：事件对象。
 *
 * 返回值：Promise<void>。
 * 可能抛出的异常：文件系统写入失败时抛出。
 */
async function appendRuntimeRunEvent(runLogPath, event = {}) {
  const record = { at: new Date().toISOString(), ...event };
  await appendFile(runLogPath, `${JSON.stringify(record)}\n`, 'utf8');
}

/**
 * generateRuntimeRunId 生成本地 Runtime runId。
 *
 * 参数：
 * - prefix：runId 前缀。
 *
 * 返回值：字符串 runId。
 * 可能抛出的异常：无。
 */
function generateRuntimeRunId(prefix = 'skill-runtime') {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${prefix}-${stamp}-${random}`;
}

/**
 * summarizeRuntimeText 截断 run log 里的用户目标摘要。
 *
 * 参数：
 * - text：用户输入。
 *
 * 返回值：最长 120 字符的单行摘要。
 * 可能抛出的异常：无。
 */
function summarizeRuntimeText(text = '') {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

async function emitNeedsInputProgress(onRuntimeEvent, input = {}) {
  if (!onRuntimeEvent) {
    return;
  }
  const missing = Array.isArray(input.missing) ? input.missing : [];
  await onRuntimeEvent({
    source: 'agent-needs-input',
    status: 'complete',
    type: 'goal.received',
  });
  await onRuntimeEvent({
    source: 'agent-needs-input',
    status: 'complete',
    type: 'skill.loaded',
  });
  await onRuntimeEvent({
    missing,
    source: 'agent-needs-input',
    status: 'waiting',
    type: 'run.needs_input',
  });
}

/**
 * buildSkillAgentResponse 把通用 Runtime 结果转成前台 Agent 线程响应。
 *
 * 参数：
 * - input.result：createSkillRuntime().runGoal() 返回值。
 * - input.sessionId：已有 Session ID，可为空。
 * - input.userText：用户输入原文。
 *
 * 返回值：前端响应对象。
 * 可能抛出的异常：无。
 */
export function buildSkillAgentResponse(input = {}) {
  const result = input.result || {};
  const skill = result.skill || {};
  const runtimeResult = result.result || {};
  const period = runtimeResult.period || {};
  const toolSummary = runtimeResult.toolSummary || {};
  const runtimeConfirmation = result.waiting ? buildRuntimePolicyConfirmation({ result, userText: input.userText }) : null;
  const artifact = hasBusinessArtifact(result.artifact)
    ? {
        ...(result.artifact || {}),
        runLogPath: result.runLogPath,
      }
    : null;
  const sessionId = input.sessionId || createAgentSessionId(result.runId);
  const trigger = result.goal?.trigger || 'natural_goal';
  const kind = runtimeConfirmation ? 'confirmation-required' : trigger === 'skill_command' ? 'skill-run' : 'goal-run';
  const progress = buildProgress(result);
  const summary = runtimeConfirmation
    ? `我已经理解这次任务,但「${runtimeConfirmation.title}」需要你确认后再继续。`
    : buildSummary({ artifact, period, result, runtimeResult, skill, toolSummary, trigger });
  const assistantMessage = {
    id: messageId('assistant'),
    role: 'assistant',
    content: summary,
    createdAt: new Date().toISOString(),
    process: {
      title: `${skill.displayName || '外贸任务'}执行过程`,
      expanded: false,
      steps: progress,
    },
    activity: buildActivityStream({ loop: result.loop }),
  };
  if (artifact) {
    assistantMessage.artifact = artifact;
  }
  if (runtimeConfirmation) {
    assistantMessage.confirmation = runtimeConfirmation;
  }

  return {
    ok: true,
    kind,
    sessionId,
    taskTitle: skill.displayName || artifact.name || '本次外贸任务',
    goal: result.goal,
    loop: result.loop,
    plan: result.plan,
    skillId: skill.id,
    status: result.loop?.status || 'completed',
    mode: runtimeResult.mode || skill.adapter || '',
    runId: result.runId,
    period,
    summary,
    progress,
    artifact,
    context: runtimeConfirmation
      ? { ...(artifact ? { artifact } : {}), period, pendingConfirmation: runtimeConfirmation }
      : { artifact, period },
    messages: [
      {
        id: messageId('user'),
        role: 'user',
        content: input.userText || '',
        createdAt: new Date().toISOString(),
      },
      assistantMessage,
    ],
  };
}

function hasBusinessArtifact(artifact = null) {
  return Boolean(artifact?.name || artifact?.workbookName || artifact?.outputPath);
}

/**
 * shouldHandleAsCurrentArtifactFollowup 判断本轮是否应优先续改当前产物。
 *
 * 作用：
 * - 同一线程已经有业务产物时，用户说“继续优化 / 写成两版 / 第1天话术”通常是在改当前材料。
 * - 这类话可能同时命中“邮件”“草稿”等新任务关键词；如果先跑新 Skill，会让线程突然换产物。
 * - 这里只识别明确编辑意图，不把“再做一个报价单 / 新客户分析”这类新任务吞掉。
 *
 * 参数：
 * - input.text：用户本轮输入。
 * - input.sessionId：当前线程 ID。
 * - input.startsFreshTask：是否明确要求重开或换客户。
 * - input.context / input.session：用于确认当前线程是否已有 artifact。
 *
 * 返回值：boolean，true 表示应走 `buildAgentFollowupResponse()`。
 * 可能抛出的异常：无。
 */
function shouldHandleAsCurrentArtifactFollowup(input = {}) {
  if (!input.sessionId || input.startsFreshTask) {
    return false;
  }

  const artifact = input.context?.artifact || input.session?.context?.artifact || null;
  if (!hasBusinessArtifact(artifact)) {
    return false;
  }

  const value = String(input.text || '').trim().toLowerCase();
  if (!value) {
    return false;
  }

  if (isChannelDraftOnlyRequest(value)) {
    return true;
  }

  return /继续|优化|修改|调整|补充|补一句|加一句|增加|删掉|删除|改成|换成|写成|整理成|重写|重新写|重新生成(?:一|1)?版|重来(?:一|1)?版|再来(?:一|1)?版|再写(?:一|1)?版|另写(?:一|1)?版|另一版|换(?:个|种)说法|换(?:个|种)表达|版本|两版|多版|话术|文案|第\s*\d+\s*天|day\s*\d+|更礼貌|更正式|更短|更强硬|语气/.test(value);
}

/**
 * buildAgentFollowupResponse 基于上一轮产物和日志生成同任务追问回复。
 *
 * 作用：
 * - 读取上一轮 manifest / run log 的摘要。
 * - 明确沿用同一次任务，避免重复触发真实采集。
 *
 * 参数：
 * - input.sessionId：当前 Session ID。
 * - input.text：用户追问。
 * - input.context：前端传回的 artifact / period 摘要。
 * - input.projectRoot：项目根目录。
 * - input.session：后端读取的 session,用于定位当前产物。
 *
 * 返回值：Promise<object>，可追加到线程的助手消息。
 * 可能抛出的异常：文件读取失败会被降级为“未读取到摘要”，不向外抛出。
 */
export async function buildAgentFollowupResponse(input = {}) {
  const context = input.context || {};
  const artifact = context.artifact || {};
  const period = context.period || {};
  const artifactName = artifact.name || artifact.workbookName || '上一份业务产物';
  const taskTitle = resolveFollowupTaskTitle({
    artifactName,
    context,
    session: input.session,
  });
  const periodText = period.start && period.end ? `${period.start} ~ ${period.end}` : '上一轮执行周期';
  const question = String(input.text || '').trim() || '继续追问';
  await emitFollowupProgress(input.onRuntimeEvent, {
    status: 'complete',
    type: 'goal.received',
  });
  const manifestSummary = await summarizeManifest(artifact.manifestPath);
  const runLogSummary = await summarizeRunLog(artifact.runLogPath || context.runLogPath);
  const details = [runLogSummary, manifestSummary].filter(Boolean).join('\n');
  await emitFollowupProgress(input.onRuntimeEvent, {
    status: 'complete',
    type: 'skill.loaded',
  });
  await emitFollowupProgress(input.onRuntimeEvent, {
    status: 'complete',
    type: 'plan.created',
  });
  const revision = await reviseCurrentArtifactIfPossible({
    artifact,
    context,
    projectRoot: input.projectRoot,
    question,
    session: input.session,
  });
  await emitFollowupProgress(input.onRuntimeEvent, {
    status: revision ? 'complete' : 'unsupported',
    type: 'action.executed',
  });
  const responseArtifact = revision?.artifact || null;
  const summary = revision?.summary || '';
  const progress = buildFollowupProgress({ artifactName, question, responseArtifact, revision });
  const activity = buildFollowupActivity({ artifactName, question, responseArtifact, revision });
  await emitFollowupProgress(input.onRuntimeEvent, {
    status: responseArtifact ? 'complete' : 'unsupported',
    type: 'artifact.verified',
  });
  if (responseArtifact) {
    await emitFollowupProgress(input.onRuntimeEvent, {
      status: 'complete',
      type: 'run.completed',
    });
  } else {
    await emitFollowupProgress(input.onRuntimeEvent, {
      missing: ['可直接续改的 Markdown 或 XLSX 产物'],
      status: 'waiting',
      type: 'run.needs_input',
    });
  }
  const canReviseCurrentArtifact = Boolean(responseArtifact);
  const responseKind = canReviseCurrentArtifact ? 'followup' : 'needs-input-followup';
  const responseStatus = canReviseCurrentArtifact ? 'completed' : 'waiting';
  const responseSummary = canReviseCurrentArtifact
    ? summary
    : `这类文件暂时不能直接改。我已保留你的要求,可以先让我重新生成可编辑的邮件、表格或跟进计划。`;

  return {
    ok: true,
    kind: responseKind,
    sessionId: input.sessionId || createAgentSessionId(),
    status: responseStatus,
    taskTitle,
    artifact: responseArtifact,
    context: responseArtifact ? { ...context, artifact: responseArtifact } : context,
    progress,
    summary: responseSummary,
    messages: [
      {
        id: messageId('assistant'),
        role: 'assistant',
        createdAt: new Date().toISOString(),
        content: [
          `我会接着这次任务处理「${question}」，不会重新采集外部数据。`,
          `当前依据是 ${periodText} 的 ${artifactName}。`,
          canReviseCurrentArtifact ? revision.summary : '暂时不能直接改这类文件。我已保留这句补充,可以继续给我可编辑的邮件、表格或跟进计划要求。',
          details || '已沿用当前线程里的产物和上下文继续处理。',
        ].filter(Boolean).join('\n'),
        process: {
          expanded: false,
          steps: progress,
          title: '同任务追问处理过程',
        },
        activity,
        needsInput: canReviseCurrentArtifact ? undefined : buildNeedsInputCard({
          missing: ['可直接续改的 Markdown 或 XLSX 产物'],
          skill: { displayName: '同任务追问' },
        }),
        artifact: responseArtifact || undefined,
      },
    ],
  };
}

/**
 * resolveFollowupTaskTitle 为同任务追问保留业务任务标题。
 *
 * 作用：
 * - 用户正在续改产物时,顶部标题应该保持“客户推进分析 / 开发信草稿”这类业务任务。
 * - 文件名属于产物卡和续接提示,不能把 `客户推进分析.md` 直接当成线程标题。
 * - 没有 session 标题时,用产物名去掉常见扩展名兜底。
 *
 * 参数：
 * - input.artifactName：当前产物名,例如 `客户推进分析.md`。
 * - input.context：当前线程上下文,可能由前端或后端恢复。
 * - input.session：后端读取的完整 session,优先从这里沿用 taskTitle。
 *
 * 返回值：用户可见的业务任务标题。
 * 可能抛出的异常：无。
 */
function resolveFollowupTaskTitle(input = {}) {
  const session = input.session || {};
  const context = input.context || {};
  const sessionTitle = session.taskTitle || '';
  const latestConfirmationTitle = latestSessionConfirmationTitle(session);
  const sessionTitleIsConfirmation = Boolean(
    session.kind === 'confirmation-required' &&
    sessionTitle &&
    latestConfirmationTitle &&
    sessionTitle === latestConfirmationTitle
  );
  const title =
    (sessionTitleIsConfirmation ? '' : sessionTitle) ||
    context.taskTitle ||
    session.skillAgentResult?.taskTitle ||
    '';
  if (title) {
    return title;
  }

  return stripArtifactExtension(input.artifactName) || '同任务追问';
}

/**
 * latestSessionConfirmationTitle 读取 session 中最近一次确认卡标题。
 *
 * 参数：
 * - session：后端保存的新对话 session。
 *
 * 返回值：最近确认卡的标题；没有确认卡时返回空字符串。
 * 可能抛出的异常：无。
 */
function latestSessionConfirmationTitle(session = {}) {
  return [...(session.messages || [])]
    .reverse()
    .find((message) => message?.confirmation?.title)
    ?.confirmation?.title || '';
}

/**
 * stripArtifactExtension 去掉常见业务产物扩展名。
 *
 * 参数：
 * - name：产物文件名。
 *
 * 返回值：不带扩展名的显示标题。
 * 可能抛出的异常：无。
 */
function stripArtifactExtension(name = '') {
  return String(name || '').replace(/\.(?:md|markdown|txt|csv|xlsx)$/i, '').trim();
}

/**
 * buildFollowupProgress 生成同任务追问的最终可回看进度。
 *
 * 作用：
 * - SSE 运行中已经显示进度；最终消息也要保留一份可展开记录。
 * - 让用户回看时知道这次追问是沿用当前产物续改,不是重新开始。
 *
 * 参数：
 * - input.artifactName：上一轮产物名称。
 * - input.question：用户本次追问或修改要求。
 * - input.responseArtifact：本轮修订后的产物；为空表示未能直接生成新产物。
 * - input.revision：修订器返回结果。
 *
 * 返回值：前台可渲染的 progress 数组。
 * 可能抛出的异常：无。
 */
function buildFollowupProgress(input = {}) {
  const artifactName = input.artifactName || '当前业务产物';
  const question = input.question || '继续追问';
  const hasRevision = Boolean(input.responseArtifact || input.revision);
  const finalStatus = hasRevision ? 'complete' : 'waiting';

  return [
    {
      detail: `已识别为对「${artifactName}」的同任务补充。`,
      label: '识别任务',
      status: 'complete',
    },
    {
      detail: '已沿用当前产物和上一轮任务上下文。',
      label: '核对资料',
      status: 'complete',
    },
    {
      detail: `已把「${question}」转成当前产物的修改步骤。`,
      label: '拆解任务',
      status: 'complete',
    },
    {
      detail: hasRevision ? '已生成本次补充后的材料。' : '当前文件类型暂不支持直接续改,先保留补充要求。',
      label: '生成材料',
      status: finalStatus,
    },
    {
      detail: hasRevision ? '已检查本次产物可以继续查看和追问。' : '等待更多资料或可支持的产物类型后继续。',
      label: '检查结果',
      status: finalStatus,
    },
  ];
}

/**
 * buildFollowupActivity 生成同任务追问的「本次操作记录」。
 *
 * 参数：
 * - input.artifactName：上一轮产物名称。
 * - input.question：用户本次补充要求。
 * - input.responseArtifact：本轮修订后的产物。
 * - input.revision：修订器返回结果。
 *
 * 返回值：前台 AgentThreadMessage 可展开的 activity 对象。
 * 可能抛出的异常：无。
 */
function buildFollowupActivity(input = {}) {
  const artifactName = input.artifactName || '当前业务产物';
  const question = input.question || '继续追问';
  const hasRevision = Boolean(input.responseArtifact || input.revision);
  const finalStatus = hasRevision ? 'complete' : 'waiting';

  return {
    expanded: false,
    items: [
      {
        detail: `识别为继续处理「${artifactName}」。`,
        kind: 'goal',
        nextAction: '核对资料',
        observation: '同一任务续接',
        status: 'complete',
        title: '识别任务',
      },
      {
        detail: '沿用当前线程里的产物和上下文。',
        kind: 'action',
        nextAction: '拆解任务',
        observation: '资料已沿用',
        status: 'complete',
        title: '核对资料',
      },
      {
        detail: `把「${question}」整理成本次修改要求。`,
        kind: 'plan',
        nextAction: '生成材料',
        observation: '已拆成修订步骤',
        status: 'complete',
        title: '拆解任务',
      },
      {
        detail: hasRevision ? '已完成当前产物的续改。' : '当前产物暂不支持直接续改。',
        kind: 'action',
        nextAction: '检查结果',
        observation: hasRevision ? '材料已生成' : '等待可支持产物',
        status: finalStatus,
        title: '生成材料',
      },
      {
        detail: hasRevision ? '本次续改结果已写回线程。' : '本次补充已保留在当前线程。',
        kind: 'observation',
        nextAction: '',
        observation: hasRevision ? '可继续追问' : '等待补充',
        status: finalStatus,
        title: '检查结果',
      },
    ],
    source: 'agent-followup',
    title: '本次操作记录',
  };
}

async function emitFollowupProgress(onRuntimeEvent, event = {}) {
  if (!onRuntimeEvent) {
    return;
  }
  await onRuntimeEvent({
    ...event,
    source: 'agent-followup',
  });
}

async function reviseCurrentArtifactIfPossible(input = {}) {
  const artifact = input.artifact || {};
  try {
    if (artifact.type === 'markdown' || /\.md$/i.test(String(artifact.outputPath || ''))) {
      return await reviseMarkdownArtifactForFollowup({
        instruction: input.question,
        projectRoot: input.projectRoot,
        session: input.session || { context: input.context || {} },
      });
    }
    if (artifact.type === 'xlsx' || /\.xlsx$/i.test(String(artifact.outputPath || ''))) {
      return await reviseXlsxArtifactForFollowup({
        instruction: input.question,
        projectRoot: input.projectRoot,
        session: input.session || { context: input.context || {} },
      });
    }
    return null;
  } catch (error) {
    if (error.code === 'ARTIFACT_REVISION_NOT_FOUND' || error.code === 'ARTIFACT_REVISION_UNSUPPORTED') {
      return null;
    }
    throw error;
  }
}

function buildProgress(result) {
  const steps = result.loop?.steps || [];
  if (steps.some((item) => item.action === 'resume.run')) {
    return buildResumeProgress(steps);
  }

  const labels = [
    ['goal.classify', '识别任务', '识别'],
    ['skill.load', '核对资料', '核对资料'],
    ['plan.create', '拆解任务', '拆步骤'],
    ['action.execute', '生成材料', '执行'],
    ['artifact.verify', '检查结果', '检查'],
  ];

  return labels.map(([action, label, fallbackPhase]) => {
    const step = steps.find((item) => item.action === action);
    return {
      label,
      detail: humanProgressDetail(action, step?.detail),
      phase: humanRuntimePhase(step?.phase) || fallbackPhase,
      status: step?.status || 'pending',
    };
  });
}

/**
 * buildResumeProgress 生成 checkpoint 续跑后的最终可见进度。
 *
 * 作用：
 * - 用户补资料或确认后,前台应显示“继续执行”,而不是重新识别任务。
 * - 如果续跑后又遇到 policy ask,必须停在“核对权限 / 等待确认”。
 * - 只展示实际发生的后续步骤,避免把还没执行的“生成材料 / 检查结果”标成 pending。
 *
 * 参数：
 * - steps：Runtime loop steps。
 *
 * 返回值：前台 progress 数组。
 * 可能抛出的异常：无。
 */
function buildResumeProgress(steps = []) {
  const progress = [];
  const addRuntimeStep = (action, label, fallbackPhase) => {
    const step = steps.find((item) => item.action === action);
    if (!step) {
      return;
    }
    progress.push({
      label,
      detail: humanProgressDetail(action, step.detail),
      phase: humanRuntimePhase(step.phase) || fallbackPhase,
      status: step.status || 'pending',
    });
  };

  addRuntimeStep('resume.run', '继续执行', '执行');

  const policySteps = steps.filter((item) => item.action === 'policy.confirm');
  const waitingPolicyStep = policySteps.find((item) => item.status === 'waiting');
  if (waitingPolicyStep) {
    progress.push({
      label: '核对权限',
      detail: '已检查这一步需要你确认。',
      phase: humanRuntimePhase(waitingPolicyStep.phase) || '执行',
      status: 'complete',
    });
    progress.push({
      label: '等待确认',
      detail: humanProgressDetail('policy.confirm', waitingPolicyStep.detail),
      phase: humanRuntimePhase(waitingPolicyStep.phase) || '执行',
      status: 'waiting',
    });
    return progress;
  }
  const policyStep = policySteps.at(-1);
  if (policyStep) {
    progress.push({
      label: '核对权限',
      detail: humanProgressDetail('policy.confirm', policyStep.detail),
      phase: humanRuntimePhase(policyStep.phase) || '执行',
      status: policyStep.status || 'complete',
    });
  }

  addRuntimeStep('action.execute', '生成材料', '执行');
  addRuntimeStep('observation.record', '整理发现', '执行');
  addRuntimeStep('artifact.verify', '检查结果', '检查');
  addRuntimeStep('finish', '完成', '收尾');
  return progress;
}

function humanProgressDetail(action, fallback = '') {
  const map = {
    'policy.confirm': fallback || '已检查这一步是否需要你确认。',
    'skill.load': '已核对任务所需资料、规则和产物要求。',
    'plan.create': fallback && !/skill|json/i.test(fallback) ? fallback : '已把这次任务拆成可执行步骤。',
    'artifact.verify': '产物已检查通过。',
  };
  return map[action] || fallback || '等待处理结果';
}

function buildSummary({ artifact, period, result, runtimeResult, skill, toolSummary, trigger }) {
  const parts = [];
  if (trigger === 'natural_goal') {
    parts.push(`我已经理解这次任务，会按「${skill.displayName || '外贸任务'}」的方式推进。`);
  } else {
    parts.push(`已收到这次任务，会按「${skill.displayName || '外贸任务'}」的方式处理。`);
  }
  if (period.start && period.end) {
    parts.push(`已完成 ${period.start} ~ ${period.end} 的业务产物。`);
  }
  if (Number.isFinite(toolSummary.succeeded) && Number.isFinite(toolSummary.attempted)) {
    parts.push(`本次完成 ${toolSummary.succeeded}/${toolSummary.attempted} 次只读采集。`);
  }
  if (artifact?.name) {
    parts.push(`产物：${artifact.name}。`);
  }
  if (runtimeResult?.validation?.workbookBytes) {
    parts.push(`大小 ${formatBytes(runtimeResult.validation.workbookBytes)}。`);
  }
  if (!parts.length && result?.loop?.status) {
    parts.push(`本轮任务状态：${result.loop.status}。`);
  }
  return parts.join(' ');
}

function buildActivityStream(input = {}) {
  const loopItems = (input.loop?.steps || []).map((step) => ({
    kind: activityKindForAction(step.action),
    phase: humanRuntimePhase(step.phase) || humanPhaseForAction(step.action),
    title: humanActivityTitle(step.action, step.title),
    detail: humanActivityDetail(step.action, step.detail),
    nextAction: humanNextAction(step.nextAction),
    observation: humanObservation(step.observation),
    status: step.status,
  }));

  return {
    title: '本次操作记录',
    expanded: false,
    source: 'skill-runtime-loop',
    items: loopItems,
  };
}

/**
 * humanRuntimePhase 把 Runtime phase key 翻译成公开中文阶段。
 *
 * 作用：
 * - Runtime 和 run log 可以保留机器阶段名。
 * - 前台消息、活动流和进度条只显示用户看得懂的短标签。
 *
 * 参数：
 * - phase：内部阶段 key。
 *
 * 返回值：中文阶段标签；无法识别时返回空字符串。
 * 可能抛出的异常：无。
 */
function humanRuntimePhase(phase = '') {
  const map = {
    assembling_context: '核对资料',
    committing: '收尾',
    executing: '执行',
    planning: '拆步骤',
    preflight: '识别',
    validating: '检查',
  };
  return map[phase] || '';
}

/**
 * humanPhaseForAction 为没有 phase 的旧 loop step 补公开阶段。
 *
 * 参数：
 * - action：Runtime loop action。
 *
 * 返回值：中文阶段标签。
 * 可能抛出的异常：无。
 */
function humanPhaseForAction(action = '') {
  const map = {
    'action.execute': '执行',
    'artifact.verify': '检查',
    finish: '收尾',
    'goal.classify': '识别',
    'observation.record': '执行',
    'plan.create': '拆步骤',
    'policy.confirm': '执行',
    'skill.load': '核对资料',
    'skill.match': '识别',
  };
  return map[action] || '';
}

function humanActivityTitle(action, fallback = '') {
  const map = {
    'goal.classify': '识别任务',
    'resume.run': '继续执行',
    'skill.match': '确认任务类型',
    'skill.load': '核对资料',
    'plan.create': '拆解任务',
    'policy.confirm': '等待确认',
    'action.execute': '生成材料',
    'observation.record': '整理发现',
    'artifact.verify': '检查结果',
    finish: '完成',
  };
  return map[action] || fallback || '处理任务';
}

function humanActivityDetail(action, fallback = '') {
  const map = {
    'resume.run': '已从刚才暂停的位置继续。',
    'skill.match': '已判断这次要产出的业务材料。',
    'skill.load': '已核对任务所需资料、规则和产物要求。',
    'plan.create': '已把这次任务拆成可执行步骤。',
    'policy.confirm': '这一步需要你确认后再继续。',
    'artifact.verify': '已检查产物是否可交付。',
    finish: '这次任务已处理到当前可交付状态。',
  };
  return map[action] || fallback || '';
}

function activityKindForAction(action) {
  if (action === 'goal.classify') {
    return 'goal';
  }
  if (action === 'skill.match') {
    return 'thought';
  }
  if (action === 'plan.create') {
    return 'plan';
  }
  if (action === 'policy.confirm') {
    return 'observation';
  }
  if (action === 'artifact.verify' || action === 'finish') {
    return 'observation';
  }
  return 'action';
}

function humanObservation(value) {
  const map = {
    'goal.matched': '已识别业务目标',
    'run.resumed': '已继续刚才的任务',
    'skill.matched': '已确认业务任务类型',
    'skill.loaded': '已核对任务所需资料和规则',
    'plan.ready': '已拆好处理步骤',
    'policy.ask': '等待用户确认',
    'action.executed': '材料已生成',
    'observation.ready': '已记录关键发现',
    'artifact.ready': '材料已检查通过',
    'run.completed': '这次任务已完成',
  };
  return map[value] || value || '';
}

function humanNextAction(value) {
  const map = {
    'skill.match': '确认任务类型',
    'skill.load': '核对资料',
    'plan.create': '拆解任务',
    'action.execute': '生成材料',
    resume_run: '等待确认后继续',
    'observation.record': '整理发现',
    'artifact.verify': '检查结果',
    finish: '完成',
    none: '',
  };
  return map[value] || value || '';
}

async function summarizeManifest(manifestPath) {
  if (!manifestPath) {
    return '';
  }
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const validation = manifest.validation || {};
    const sheetCount = Array.isArray(manifest.requiredSheets) ? manifest.requiredSheets.length : 0;
    const parts = [];
    if (sheetCount > 0) {
      parts.push(`产物要求 ${sheetCount} 个工作表`);
    }
    if (validation.workbookBytes) {
      parts.push(`文件大小 ${formatBytes(validation.workbookBytes)}`);
    }
    if (validation.builderExitCode === 0) {
      parts.push('产物生成已完成');
    }
    return parts.length ? `产物摘要：${parts.join('，')}。` : '';
  } catch {
    return '';
  }
}

async function summarizeRunLog(runLogPath) {
  if (!runLogPath) {
    return '';
  }
  try {
    const events = (await readFile(runLogPath, 'utf8'))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const completed = events.find((event) => event.type === 'run.completed');
    const artifact = events.find((event) => event.type === 'artifact.verified' || event.type === 'artifact.validated');
    const actionCount = events.filter((event) => /^(action|tool)\./.test(event.type)).length;
    const parts = [];
    if (actionCount > 0) {
      parts.push(`上一轮记录了 ${actionCount} 个执行动作`);
    }
    if (artifact) {
      parts.push('产物校验已记录');
    }
    if (completed) {
      parts.push('任务已完成');
    }
    return parts.length ? `执行摘要：${parts.join('，')}。` : '';
  } catch {
    return '';
  }
}

function createAgentSessionId(runId = '') {
  const suffix = String(runId || '').split('-').slice(-1)[0] || Math.random().toString(36).slice(2, 8);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return `agent-session-${stamp}-${suffix}`;
}

function messageId(role) {
  return `${role}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return '未返回';
  }
  if (number < 1024) {
    return `${number} B`;
  }
  return `${(number / 1024).toFixed(1)} KB`;
}
