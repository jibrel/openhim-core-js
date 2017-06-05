// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
import { Channel } from '../model/channels';
import { Mediator } from '../model/mediators';
import Q from 'q';
import logger from 'winston';
import authorisation from './authorisation';
import semver from 'semver';
import atna from 'atna-audit';

import utils from "../utils";
import auditing from '../auditing';

let mask = '**********';

var maskPasswords = function(defs, config) {
  if (!config) {
    return;
  }

  return defs.forEach(function(d) {
    if ((d.type === 'password') && config[d.param]) {
      if (d.array) {
        config[d.param] = config[d.param].map(() => mask);
      } else {
        config[d.param] = mask;
      }
    }
    if ((d.type === 'struct') && config[d.param]) {
      return maskPasswords(d.template, config[d.param]);
    }});
};

var restoreMaskedPasswords = function(defs, maskedConfig, config) {
  if (!maskedConfig || !config) {
    return;
  }

  return defs.forEach(function(d) {
    if ((d.type === 'password') && maskedConfig[d.param] && config[d.param]) {
      if (d.array) {
        maskedConfig[d.param].forEach(function(p, i) {
          if (p === mask) {
            return maskedConfig[d.param][i] = config[d.param][i];
          }});
      } else {
        if (maskedConfig[d.param] === mask) {
          maskedConfig[d.param] = config[d.param];
        }
      }
    }
    if ((d.type === 'struct') && maskedConfig[d.param] && config[d.param]) {
      return restoreMaskedPasswords(d.template, maskedConfig[d.param], config[d.param]);
    }});
};

export function getAllMediators() {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getAllMediators denied.`, 'info');
    return;
  }

  try {
    let m = {}; //TODO:Fix yield Mediator.find().exec()
    maskPasswords(m.configDefs, m.config);
    return this.body = m;
  } catch (err) {
    return logAndSetResponse(this, 500, `Could not fetch mediators via the API: ${err}`, 'error');
  }
}



export function getMediator(mediatorURN) {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to getMediator denied.`, 'info');
    return;
  }

  let urn = unescape(mediatorURN);

  try {
    let result = {}; //TODO:Fix yield Mediator.findOne({ "urn": urn }).exec()
    if (result === null) {
      return this.status = 404;
    } else {
      maskPasswords(result.configDefs, result.config);
      return this.body = result;
    }
  } catch (err) {
    return logAndSetResponse(this, 500, `Could not fetch mediator using UUID ${urn} via the API: ${err}`, 'error');
  }
}

 function constructError(message, name) {
  let err = new Error(message);
  err.name = name;
  return err;
};


var validateConfigDef = function(def) {
  if ((def.type === 'struct') && !def.template) {
    throw constructError(`Must specify a template for struct param '${def.param}'`, 'ValidationError');

  } else if (def.type === 'struct') {
    return (() => {
      let result = [];
      for (let templateItem of Array.from(def.template)) {
        if (!templateItem.param) {
          throw constructError(`Must specify field 'param' in template definition for param '${def.param}'`, 'ValidationError');
        }

        if (!templateItem.type) {
          throw constructError(`Must specify field 'type' in template definition for param '${def.param}'`, 'ValidationError');
        }

        if (templateItem.type === 'struct') {
          throw constructError(`May not recursively specify 'struct' in template definitions (param '${def.param}')`, 'ValidationError');
        }

        result.push(validateConfigDef(templateItem));
      }
      return result;
    })();

  } else if (def.type === 'option') {
    if (!utils.typeIsArray(def.values)) {
      throw constructError(`Expected field 'values' to be an array (option param '${def.param}')`, 'ValidationError');
    }
    if ((def.values == null) || (def.values.length === 0)) {
      throw constructError(`Must specify a values array for option param '${def.param}'`, 'ValidationError');
    }
  }
};

// validations additional to the mongoose schema validation
let validateConfigDefs = configDefs => Array.from(configDefs).map((def) => validateConfigDef(def));


export function addMediator() {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to addMediator denied.`, 'info');
    return;
  }

  try {
    let mediatorHost;
    let mediator = this.request.body;

    if (__guard__(__guard__(mediator != null ? mediator.endpoints : undefined, x1 => x1[0]), x => x.host) != null) {
      mediatorHost = mediator.endpoints[0].host;
    } else {
      mediatorHost = 'unknown';
    }

    // audit mediator start
    let audit = atna.appActivityAudit(true, mediator.name, mediatorHost, 'system');
    audit = atna.wrapInSyslog(audit);
    auditing.sendAuditEvent(audit, () => logger.info(`Processed internal mediator start audit for: ${mediator.name} - ${mediator.urn}`));

    if (!mediator.urn) {
      throw constructError('URN is required', 'ValidationError');
    }
    if (!mediator.version || !semver.valid(mediator.version)) {
      throw constructError('Version is required. Must be in SemVer form x.y.z', 'ValidationError');
    }

    if (mediator.configDefs) {
      validateConfigDefs(mediator.configDefs);
      if (mediator.config != null) {
        validateConfig(mediator.configDefs, mediator.config);
      }
    }

    let existing = {}; //TODO:Fix yield Mediator.findOne({urn: mediator.urn}).exec()
    if (existing != null) {
      if (semver.gt(mediator.version, existing.version)) {
        // update the mediator
        if ((mediator.config != null) && (existing.config != null)) {
          // if some config already exists, add only config that didn't exist previously
          for (let param in mediator.config) {
            let val = mediator.config[param];
            if (existing.config[param] != null) {
              mediator.config[param] = existing.config[param];
            }
          }
        }
        ({}); //TODO:Fix yield Mediator.findByIdAndUpdate(existing._id, mediator).exec()
      }
    } else {
      // this is a new mediator validate and save it
      if (!mediator.endpoints || (mediator.endpoints.length < 1)) {
        throw constructError('At least 1 endpoint is required', 'ValidationError');
      }
      ({}); //TODO:Fix yield Q.ninvoke(new Mediator(mediator), 'save')
    }
    this.status = 201;
    return logger.info(`User ${this.authenticated.email} created mediator with urn ${mediator.urn}`);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return utils.logAndSetResponse(this, 400, `Could not add Mediator via the API: ${err}`, 'error');
    } else {
      return utils.logAndSetResponse(this, 500, `Could not add Mediator via the API: ${err}`, 'error');
    }
  }
}

export function removeMediator(urn) {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeMediator denied.`, 'info');
    return;
  }

  urn = unescape(urn);

  try {
    ({}); //TODO:Fix yield Mediator.findOneAndRemove({ urn: urn }).exec()
    this.body = `Mediator with urn ${urn} has been successfully removed by ${this.authenticated.email}`;
    return logger.info(`Mediator with urn ${urn} has been successfully removed by ${this.authenticated.email}`);
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not remove Mediator by urn ${urn} via the API: ${err}`, 'error');
  }
}

export function heartbeat(urn) {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeMediator denied.`, 'info');
    return;
  }

  urn = unescape(urn);

  try {
    let mediator = {}; //TODO:Fix yield Mediator.findOne({ urn: urn }).exec()

    if ((mediator == null)) {
      this.status = 404;
      return;
    }

    let heartbeat = this.request.body;

    if (((heartbeat != null ? heartbeat.uptime : undefined) == null)) {
      this.status = 400;
      return;
    }

    if ((mediator._configModifiedTS > mediator._lastHeartbeat) || ((heartbeat != null ? heartbeat.config : undefined) === true)) {
      // Return config if it has changed since last heartbeat
      this.body = mediator.config;
    } else {
      this.body = "";
    }

    // set internal properties
    if (heartbeat != null) {
      let update = {
        _lastHeartbeat: new Date(),
        _uptime: heartbeat.uptime
      };

      ({}); //TODO:Fix yield Mediator.findByIdAndUpdate(mediator._id, update).exec()
    }

    return this.status = 200;
  } catch (err) {
    return utils.logAndSetResponse(this, 500, `Could not process mediator heartbeat (urn: ${urn}): ${err}`, 'error');
  }
}


 function validateConfigField(param, def, field) {
  switch (def.type) {
    case 'string':
      if (typeof field !== 'string') {
        throw constructError(`Expected config param ${param} to be a string.`, 'ValidationError');
      }
      break;

    case 'bigstring':
      if (typeof field !== 'string') {
        throw constructError(`Expected config param ${param} to be a large string.`, 'ValidationError');
      }
      break;

    case 'number':
      if (typeof field !== 'number') {
        throw constructError(`Expected config param ${param} to be a number.`, 'ValidationError');
      }
      break;

    case 'bool':
      if (typeof field !== 'boolean') {
        throw constructError(`Expected config param ${param} to be a boolean.`, 'ValidationError');
      }
      break;

    case 'option':
      if ((def.values.indexOf(field)) === -1) {
        throw constructError(`Expected config param ${param} to be one of ${def.values}`, 'ValidationError');
      }
      break;

    case 'map':
      if (typeof field !== 'object') {
        throw constructError(`Expected config param ${param} to be an object.`, 'ValidationError');
      }
      return (() => {
        let result = [];
        for (let k in field) {
          let v = field[k];
          let item;
          if (typeof v !== 'string') {
            throw constructError(`Expected config param ${param} to only contain string values.`, 'ValidationError');
          }
          result.push(item);
        }
        return result;
      })();

    case 'struct':
      if (typeof field !== 'object') {
        throw constructError(`Expected config param ${param} to be an object.`, 'ValidationError');
      }
      let templateFields = (def.template.map(tp => tp.param));
      return (() => {
        let result1 = [];
        for (let paramField in field) {
          let item1;
          if (!Array.from(templateFields).includes(paramField)) {
            throw constructError(`Field ${paramField} is not defined in template definition for config param ${param}.`, 'ValidationError');
          }
          result1.push(item1);
        }
        return result1;
      })();

    case 'password':
      if (typeof field !== 'string') {
        throw constructError(`Expected config param ${param} to be a string representing a password.`, 'ValidationError');
      }
      break;
  }
};

var validateConfig = (configDef, config) =>
  // reduce to a single true or false value, start assuming valid
  Object.keys(config).every(function(param) {
    // find the matching def if there is one
    let matchingDefs = configDef.filter(def => def.param === param);

    // fail if there isn't a matching def
    if (matchingDefs.length === 0) {
      throw constructError(`No config definition found for parameter ${param}`, 'ValidationError');
    }

    // validate the param against the defs
    return matchingDefs.map(function(def) {
      if (def.array) {
        if (!utils.typeIsArray(config[param])) {
          throw constructError(`Expected config param ${param} to be an array of type ${def.type}`, 'ValidationError');
        }

        return Array.from(config[param]).map((field, i) =>
          validateConfigField(`${param}[${i}]`, def, field));
      } else {
        return validateConfigField(param, def, config[param]);
      }});})
;

if (process.env.NODE_ENV === "test") {
  exports.validateConfig = validateConfig;
}


export function setConfig(urn) {
  // Must be admin
  let err;
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeMediator denied.`, 'info');
    return;
  }

  urn = unescape(urn);
  let config = this.request.body;

  try {
    let mediator = {}; //TODO:Fix yield Mediator.findOne({ urn: urn }).exec()

    if ((mediator == null)) {
      this.status = 404;
      this.body = 'No mediator found for this urn.';
      return;
    }
    try {
      restoreMaskedPasswords(mediator.configDefs, config, mediator.config);
      validateConfig(mediator.configDefs, config);
    } catch (error) {
      err = error;
      this.status = 400;
      this.body = err.message;
      return;
    }

    ({}); //TODO:Fix yield Mediator.findOneAndUpdate({ urn: urn }, { config: this.request.body, _configModifiedTS: new Date() }).exec()
    return this.status = 200;
  } catch (error1) {
    err = error1;
    return utils.logAndSetResponse(this, 500, `Could not set mediator config (urn: ${urn}): ${err}`, 'error');
  }
}

 function saveDefaultChannelConfig(channels) {
  let promises = [];
  for (let channel of Array.from(channels)) {
    delete channel._id;
    for (let route of Array.from(channel.routes)) {
      delete route._id;
    }
    promises.push(new Channel(channel).save());
  }
  return promises;
};

export function loadDefaultChannels(urn) {
  // Must be admin
  if (!authorisation.inGroup('admin', this.authenticated)) {
    utils.logAndSetResponse(this, 403, `User ${this.authenticated.email} is not an admin, API access to removeMediator denied.`, 'info');
    return;
  }

  urn = unescape(urn);
  let channels = this.request.body;

  try {
    let mediator = {}; //TODO:Fix yield Mediator.findOne({ urn: urn }).lean().exec()

    if ((mediator == null)) {
      this.status = 404;
      this.body = 'No mediator found for this urn.';
      return;
    }

    if ((channels == null) || (channels.length === 0)) {
      ({}); //TODO:Fix yield Q.all saveDefaultChannelConfig(mediator.defaultChannelConfig)
    } else {
      let filteredChannelConfig = mediator.defaultChannelConfig.filter(channel => Array.from(channels).includes(channel.name));
      if (filteredChannelConfig.length < channels.length) {
        utils.logAndSetResponse(this, 400, `Could not load mediator default channel config, one or more channels in the request body not found in the mediator config (urn: ${urn})`, 'error');
        return;
      } else {
        ({}); //TODO:Fix yield Q.all saveDefaultChannelConfig(filteredChannelConfig)
      }
    }

    return this.status = 201;
  } catch (err) {
    logger.debug(err.stack);
    return utils.logAndSetResponse(this, 500, `Could not load mediator default channel config (urn: ${urn}): ${err}`, 'error');
  }
}

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}