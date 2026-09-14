const { createOperationsHandler } = require('./operations-diagnosis');

// 追问复用诊断接口的同源校验、心跳、取消和脱敏日志；凭据独立配置。
module.exports = createOperationsHandler({ kind: 'chat' });
