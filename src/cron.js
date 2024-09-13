const cron = require('node-cron');
const { CronLogs } = require('./models');
const dbService = require('./services/db.service');
const { cronService } = require('./services');
const logger = require('./config/logger');
const { systemIp } = require('./utils/getSystemIP');
const config = require('./config/config');

const updateCronStatus = async (logData, timeTaken, { success = true, error } = {}) => {
  try {
    const status = success ? 'success' : 'fail';
    const updateParams = { timeTaken, status };
    if (error) {
      Object.assign(updateParams, { error });
    }
    await dbService.updateOne({
      model: CronLogs,
      filter: { _id: logData._id },
      updateParams,
    });
  } catch (err) {
    await dbService.updateOne({
      model: CronLogs,
      filter: { _id: logData._id },
      updateParams: { timeTaken, status: 'fail', error: err },
    });
  }
};

const initiatPenddingCrons = async () => {
  const pendingCrons = await dbService.getAll({ model: CronLogs, filter: { status: 'pending' } });
  pendingCrons.forEach(async (pendingCron) => {
    const { method } = pendingCron;
    let timeTaken = new Date().getTime();
    if (typeof cronService[method] === 'function') {
      try {
        await cronService[method]();
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(pendingCron, timeTaken, { success: true });
      } catch (error) {
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(pendingCron, timeTaken, { success: false, error });
      }
    } else {
      updateCronStatus(pendingCron, timeTaken, {
        success: false,
        error: `Function ${method} not found at initiating cron on server re-start`,
      });
      logger.error(`Function ${method} not found at initiating cron on server re-start`);
    }
  });
};

const cronStart = () => {
  initiatPenddingCrons();

  cron.schedule('* * * * *', async () => {
    const log = {
      method: 'sendScheduledEmailAndSmsMinutely',
      status: 'pending',
      pid: process.pid,
      systemIp,
    };
    const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
    let timeTaken = new Date().getTime();
    try {
      await cronService.sendScheduledEmailAndSmsMinutely();
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken);
    } catch (error) {
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken, { success: false, error });
    }
  });

  cron.schedule('0 7 * * *', async () => {
    const log = {
      method: 'sendScheduledEmailAndSmsDaily',
      status: 'pending',
      pid: process.pid,
      systemIp,
    };
    const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
    let timeTaken = new Date().getTime();
    try {
      await cronService.sendScheduledEmailAndSmsDaily();
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken);
    } catch (error) {
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken, { success: false, error });
    }
  });

  cron.schedule('0 7 * * *', async () => {
    const log = {
      method: 'sendAppointmentReminderDaily',
      status: 'pending',
      pid: process.pid,
      systemIp,
    };
    const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
    let timeTaken = new Date().getTime();
    try {
      await cronService.sendAppointmentReminderDaily();
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken);
    } catch (error) {
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken, { success: false, error });
    }
  });

  cron.schedule('* * * * *', async () => {
    const log = {
      method: 'sendAppointmentReminderMinutely',
      status: 'pending',
      pid: process.pid,
      systemIp,
    };
    const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
    let timeTaken = new Date().getTime();
    try {
      await cronService.sendAppointmentReminderMinutely();
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken);
    } catch (error) {
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken, { success: false, error });
    }
  });

  // const sendBirthdayRemindersTask = cron.schedule('0 */2 * * *', async () => {
  //   const log = {
  //     method: 'sendBirthdayReminders',
  //     status: 'pending',
  //   };
  //   const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
  //   let timeTaken = new Date().getTime();
  //   try {
  //     await cronService.sendBirthdayReminders();
  //     timeTaken = new Date().getTime() - timeTaken;
  //     updateCronStatus(logData, timeTaken);
  //   } catch (error) {
  //     timeTaken = new Date().getTime() - timeTaken;
  //     updateCronStatus(logData, timeTaken, { success: false, error });
  //   }
  // });

  cron.schedule('*/5 * * * *', async () => {
    const log = {
      method: 'markAppointmentMissedTask',
      status: 'pending',
      pid: process.pid,
      systemIp,
    };
    const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
    let timeTaken = new Date().getTime();
    try {
      await cronService.markAppointmentMissed();
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken);
    } catch (error) {
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken, { success: false, error });
    }
  });

  cron.schedule('0 * * * *', async () => {
    const log = {
      method: 'sendUnreadChatMailAndSmsToPatients',
      status: 'pending',
      pid: process.pid,
      systemIp,
    };
    const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
    let timeTaken = new Date().getTime();
    try {
      await cronService.sendUnreadChatMailAndSmsToPatients();
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken, { success: true });
    } catch (error) {
      timeTaken = new Date().getTime() - timeTaken;
      updateCronStatus(logData, timeTaken, { success: false, error });
    }
  });

  cron.schedule(
    '0 1 * * *',
    async () => {
      const log = {
        method: 'maintainClinicWisePatientsCount',
        status: 'pending',
        pid: process.pid,
        systemIp,
      };
      const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
      let timeTaken = new Date().getTime();
      try {
        await cronService.maintainClinicWisePatientsCount();
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken);
      } catch (error) {
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken, { success: false, error });
      }
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    }
  );
  cron.schedule(
    '0 2 * * *',
    async () => {
      if(config.mailEnv !== "production") return;
      const log = {
        method: 'sendTrustPilotReviewAfsTriggerEmail',
        status: 'pending',
        pid: process.pid,
        systemIp,
      };
      const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
      let timeTaken = new Date().getTime();
      try {
        await cronService.trustPilotReviewAfsTriggerEmailService();
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken);
      } catch (error) {
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken, { success: false, error });
      }
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    }
  );

  cron.schedule(
    '0 7 * * *',
    async () => {
      const log = {
        method: 'sendInvoiceOnIssueDate',
        status: 'pending',
        pid: process.pid,
        systemIp,
      };
      const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
      let timeTaken = new Date().getTime();
      try {
        await cronService.sendInvoiceOnIssueDate();
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken);
      } catch (error) {
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken, { success: false, error });
      }
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    }
  );

  cron.schedule(
    '0 1 * * *',
    async () => {
      const log = {
        method: 'markInvoiceExpiredOrPastDueTask',
        status: 'pending',
        pid: process.pid,
        systemIp,
      };
      const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
      let timeTaken = new Date().getTime();
      try {
        await cronService.markInvoiceExpiredOrPastDue();
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken);
      } catch (error) {
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken, { success: false, error });
      }
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    }
  );
  cron.schedule(
    '0 2 * * *',
    async () => {
      const log = {
        method: 'recurringInvoiceCron',
        status: 'pending',
        pid: process.pid,
        systemIp,
      };
      const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
      let timeTaken = new Date().getTime();
      try {
        await cronService.recurringInvoiceCron();
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken);
      } catch (error) {
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken, { success: false, error });
      }
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    }
  );

  cron.schedule(
    '0 4 * * *',
    async () => {
      const log = {
        method: 'cancelSubscriptionsInQueue',
        status: 'pending',
        pid: process.pid,
        systemIp,
      };
      const logData = await dbService.createOne({ model: CronLogs, reqParams: { ...log } });
      let timeTaken = new Date().getTime();
      try {
        await cronService.cancelSubscriptionPlansInQueue();
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken);
      } catch (error) {
        timeTaken = new Date().getTime() - timeTaken;
        updateCronStatus(logData, timeTaken, { success: false, error });
      }
    },
    {
      scheduled: true,
      timezone: 'America/Chicago',
    }
  );
};

module.exports = cronStart;
