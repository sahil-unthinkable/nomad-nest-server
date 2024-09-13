
const socketServer = require('socket.io');
const mongoose = require('mongoose');
const config = require('./config/config');
const { isJSONObject, getFieldType, isDate, isMatch } = require('./utils/pureFunctions');
const { getObjectId } = require('./utils');
const { decryptCrypto } = require('./utils/cyrpto');
const logger = require('./config/logger');
const { chatChannelHistoryService } = require('./services');

const subscription = {};

const getRequestParams = function (req) {
  const requestParams = {};
  Object.keys(req.query).forEach((val) => {
    requestParams[val] = req.query[val];
  });
  Object.keys(req.params).forEach((val) => {
    requestParams[val] = req.query[val];
  });
  return requestParams;
};

const convertValue = (schema, field, value) => {
  const fieldInfo = getFieldType(schema, field);
  if (fieldInfo === 'Date') {
    let convertedValue;
    try {
      if (Array.isArray(value)) {
        convertedValue = [];
        for (let v of value) {
          if (fieldInfo === 'Date') {
            if (!isDate(v)) {
              v = new Date(v);
            }
            convertedValue.push(v);
          } else if (fieldInfo._isModel) {
            convertedValue.push(getObjectId(v));
          }
        }
      } else if (isJSONObject(value)) {
        convertedValue = {};
        for (const key in value) {
          let v = value[key];
          if (key === '$in' || key === '$nin') {
            const convertedVls = [];
            for (let vl of v) {
              if (fieldInfo === 'Date') {
                if (!isDate(vl)) {
                  vl = new Date(vl);
                }
                convertedVls.push(vl);
              } else if (fieldInfo._isModel) {
                convertedVls.push(getObjectId(vl));
              } else {
                convertedVls.push(vl);
              }
            }
            convertedValue[key] = convertedVls;
          } else if (key === '$exists') {
            convertedValue[key] = v;
          } else if (fieldInfo === 'Date') {
            if (!isDate(v)) {
              v = new Date(v);
            }
            convertedValue[key] = v;
          } else if (fieldInfo._isModel) {
            convertedValue[key] = getObjectId(v);
          }
        }
      } else if (fieldInfo === 'Date') {
        if (!isDate(value)) {
          convertedValue = new Date(value);
        } else {
          convertedValue = value;
        }
      } else if (fieldInfo._isModel) {
        convertedValue = getObjectId(value);
      }
    } catch (err) {
      convertedValue = value;
    }
    return convertedValue;
  }
  return value;
};

const typecastFilter = (schema, filterValue) => {
  try {
    if (isJSONObject(filterValue)) {
      for (const key in filterValue) {
        const f = key.split('.')[0];
        const value = filterValue[key];
        if (key === '$and' || key === '$or') {
          if (Array.isArray(value)) {
            for (const val of value) {
              if (isJSONObject(val)) {
                typecastFilter(schema, val);
              }
            }
          } else {
            throw new Error(
              `Invalid value [${JSON.stringify(
                value
              )}] of key [${key}] in type cast filter. The value type should be an array.`
            );
          }
        } else if (key.startsWith('$')) {
          continue;
        } else if (schema[f]) {
          filterValue[key] = convertValue(schema, f, value);
        } else {
          throw new Error(
            `Field [${f}] not found with key [${key}] and value [${JSON.stringify(value)}] in type cast filter.`
          );
        }
      }
    } else {
      throw new Error(`Invalid filter [${JSON.stringify(filterValue)}] in type cast filter.`);
    }
  } catch (err) {}
};

const configure = async function (server, app) {
  const io = socketServer(server, { cors: { origin: config.whitelistedURL, credentials: true } });

  io.on('connection', async (socket) => {
    socket.on('join', async ({ uid, _metaData , practice = '' , patient = ''}) => {
      // _metaData = JSON.parse(decryptCrypto({ ciphertext: _metaData }));
      // const { model, ...rest } = _metaData || {};
      // if (!subscription[model]) {
        //   subscription[model] = {};
        // }
        // subscription[model][uid] = { ...rest };
        socket.join(uid, () => {
          socket.emit('joined', uid);
        });
        const uidParts = uid.split('-');
        if (uidParts.length >= 2 && uidParts[0] === "unread" && uidParts[1] === "count" && practice && patient) {  
          await chatChannelHistoryService.updatePatientOnlineStatus({patient , practice , status : true});
        }
    });

    socket.on('leave', async ({ uid, _metaData ,practice = '' , patient = ''}) => {
      if(_metaData){
        _metaData = JSON.parse(decryptCrypto({ ciphertext: _metaData }));
        const { model } = _metaData || {};
        if (subscription[model]) {
          delete subscription[model][uid];
        }
      }
      socket.leave(uid, () => {
        // socket.emit('joined', groupId);
      });
      const uidParts = uid.split('-');
        if (uidParts.length >= 2 && uidParts[0] === "unread" && uidParts[1] === "count" && practice && patient) {  
          await chatChannelHistoryService.updatePatientOnlineStatus({patient , practice , status : false});
      }
    });
  });

  const getFieldData = async ({ modelName, _id, populate }) => {
    try {
      const model = mongoose.model(modelName);
      let docsPromise = model.find({ _id });
      if (populate && populate.length) {
        populate.split(',').forEach((populateOption) => {
          docsPromise = docsPromise.populate(
            populateOption
              .split('.')
              .reverse()
              .reduce((a, b) => ({ path: b, populate: a }))
          );
        });
      }
      docsPromise = await docsPromise.exec();
      return docsPromise;
    } catch (err) {
      logger.error('error in getFieldData', err);
    }
  };

  const getDataCount = async ({ modelName, filter }) => {
    try {
      const model = mongoose.model(modelName);
      const docsPromise = await model.countDocuments(filter);
      return docsPromise;
    } catch (err) {
      logger.error('error in getDataCount', err);
    }
  };

  const getGroupIdArray = ({ model, data, oldData, paths, dbOperation: operation }) => {
    try {
      const userFilter = subscription[model] || {};
      const groupIdArray = [];
      for (const [key, value] of Object.entries(userFilter)) {
        const { count, filter } = value;
        typecastFilter(paths, filter);
        typecastFilter(paths, data);
        const isNewDataMatched = isMatch(data, filter);
        if (isNewDataMatched) {
          groupIdArray.push({ key, value, operation, count });
        }
        if (oldData && !isNewDataMatched) {
          typecastFilter(paths, oldData);
          if (isMatch(oldData, filter)) {
            if (count) {
              groupIdArray.push({ key, value, operation: 'updated', count });
            } else {
              groupIdArray.push({ key, value, operation: 'remove' });
            }
          }
        }
      }
      return groupIdArray;
    } catch (err) {
      logger.error('error in getGroupIdArray', err);
    }
  };

  app.post('/notifyGroup', async (req, res) => {
    try {
      const { body } = req || {};
      for (const item of body) {
        const { operation: dbOperation, groupIdArray = [] } = item || {};
        // const groupIdArray = getGroupIdArray({ model, data, oldData, paths, dbOperation });
        // const promises = groupIdArray.map(async (groupId) => {
        //   const { key: uid, operation, count, value: { filter } = {} } = groupId;
        //   if (count) {
        //     const doc = await getDataCount({ modelName: model, filter });
        //     return { result: { count: doc }, uid, operation };
        //   }
        //   const [result] = await getFieldData({ modelName: model, _id: data.id || data._id, ...groupId.value, count });
        //   return { result, uid, operation };
        // });
        // const results = await Promise.all(promises);
        groupIdArray.forEach((val) => {
          const { groupName, data } = val || {};
          if (data._id) {
            data.id = data._id;
          }
          io.to(groupName).emit('data', { data, operation: dbOperation, uid: groupName });
        });
      }

      res.send({ status: 200, message: 'Update Successfully' });
    } catch (error) {
      res.send({ status: 400, message: error.message });
    }
  });

  app.post('/addSubscription', (req, res) => {
    try {
      const { body } = req;
      const { filter, model, uid, populate } = body || {};
      if (!subscription[model]) {
        subscription[model] = {};
      }
      subscription[model][uid] = { filter, populate };
      res.send({ status: 200, message: 'Subscription added successfully' });
    } catch (error) {
      res.send({ status: 400, message: error.message });
    }
  });

  app.post('/removeSubscription', (req, res) => {
    try {
      const { uid, model } = getRequestParams(req);
      if (subscription[model]) {
        delete subscription[model][uid];
      }
      res.send({ status: 200, message: 'Subscription removed successfully' });
    } catch (error) {
      res.send({ status: 400, message: error.message });
    }
  });
};

module.exports = {
  configure,
};
