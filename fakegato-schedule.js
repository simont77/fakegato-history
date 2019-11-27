/*jshint esversion: 6,node: true,-W041: false */
'use strict';

const Format = require('util').format;
var scheduler = require('node-schedule');

var homebridge;
var Characteristic, Service;


module.exports = function (pHomebridge) {
	if (pHomebridge && !homebridge) {
		homebridge = pHomebridge;
		Characteristic = homebridge.hap.Characteristic;
		Service = homebridge.hap.Service;
  }


  /*
   *  custom characteristics
   */

  class ProgramData extends Characteristic {
    constructor() {
      super('ProgramData', ProgramData.UUID);
      this.setProps({
        format: Characteristic.Formats.DATA,
        perms: [
          Characteristic.Perms.READ, Characteristic.Perms.HIDDEN
        ]
      });
    }
  }
  ProgramData.UUID = 'E863F12F-079E-48FF-8F27-9C2605A29F52';
  
  class ProgramCommand extends Characteristic {
    constructor() {
      super('ProgramCommand', ProgramCommand.UUID);
      this.setProps({
        format: Characteristic.Formats.DATA,
        perms: [
          Characteristic.Perms.WRITE, Characteristic.Perms.HIDDEN
        ]
      });
    }
  }
  ProgramCommand.UUID = 'E863F12C-079E-48FF-8F27-9C2605A29F52';
  
  class FirmwareInfo extends Characteristic {
    constructor() {
      super('FirmwareInfo', FirmwareInfo.UUID);
      this.setProps({
        format: Characteristic.Formats.DATA,
        perms: [
          Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.HIDDEN
        ]
      });
    }
  }
  FirmwareInfo.UUID = 'E863F11E-079E-48FF-8F27-9C2605A29F52';


  /*
   *  utility functions
   */

  function parseProgram(buf) {
    let program = {};
    program.periods = [];
    program.hex = buf.toString('hex');

    let ofs = 0;
    // loop through max. 3 heating periods
    for (let i = 0; i < 3; i++) {
      let str = buf.readUInt8(ofs);
      let end = buf.readUInt8(ofs+1);
      //let str = parseInt(hexVal.substring(ofs, ofs+2), 16);
      //let end = parseInt(hexVal.substring(ofs+2, ofs+4), 16);
      if (str != 0xFF) {
        str = str * 10;
        end = end * 10;
        let strMinute = str % 60;
        let strHour = (str - strMinute) / 60;
        let endMinute = end % 60;
        let endHour = (end - endMinute) / 60;
        program.periods.push({
          strHour: strHour,
          strMinute: strMinute,
          endHour: endHour,
          endMinute: endMinute
        });
      }
      ofs += 2;
    }

    return program;
  }

  function leadingZeroString(val) {
    return (val < 10) ? Format('0%d', val) : val.toString();
  }
  
  function programToDisplayString(program) {
    let progStr = '';

    if (!Array.isArray(program.periods)) {
      return null;
    }

    program.periods.forEach((elem, idx) => {
      if (idx > 0) {
        progStr += ' / ';
      }
      progStr += Format('%s:%s - %s:%s', 
        leadingZeroString(elem.strHour),
        leadingZeroString(elem.strMinute),
        leadingZeroString(elem.endHour),
        leadingZeroString(elem.endMinute)
      );
    });

    return progStr;
  }

  const DEFAULT_PROG = {
    periods: [
      {
        strHour: 6, strMinute: 0,
        endHour: 9, endMinute: 0
      },
      {
        strHour: 17, strMinute: 0,
        endHour: 22, endMinute: 0
      }
    ],
    hex: '24366684fffffffff' // This string must match to the period entries above!
  };


  /*
   *  main class
   */
  
  class FakeGatoSchedule {
    constructor(type, logger) {
      this.scheduleModeType = type || 'unknown';
      this.log = logger || {};
      if (!this.log.debug) {
        this.log.debug = DEBUG ? console.log : () => {};
      }
      if (!this.log.warn) {
        this.log.warn = console.log;
      }

      this.registered = false;
      this.service_thermostat = null;
      this.charac_targetTemp = null;
      this.charac_targetState = null;
      this.jobs = [];

      this.scheduleMode  = false;
      this.tempOfs  = -1.5;
      this.tempLo   = 17;
      this.tempHi   = 21;
      this.program1 = DEFAULT_PROG;
      this.program2 = DEFAULT_PROG;
      this.program3 = DEFAULT_PROG;
      this.program4 = DEFAULT_PROG;
      this.program5 = DEFAULT_PROG;
      this.program6 = DEFAULT_PROG;
      this.program7 = DEFAULT_PROG;
      this.programFree = DEFAULT_PROG;

      this.vacationMode = false;
      this.vacationTemp = null;
      this.tempBeforeVacation = null;
      this.scheduleModeBeforeVacation = false;

      this.openWindow = false;
      this.openWindowTimer = null;
      this.scheduleModeBeforeOpenWindow = false;
    }
  
    registerScheduleEvents(service) {
      if (this.registered) {
        this.log.warn('schedule events already registerted!');
        return;
      }

      if (this.scheduleModeType === 'thermo') {
        service.addCharacteristic(ProgramData)
          .on('get', this.cb_getProgramData.bind(this));

        service.addCharacteristic(ProgramCommand)
          .on('set', this.cb_setProgramCommand.bind(this));

        service.addCharacteristic(FirmwareInfo)
          .updateValue(Buffer.from('2ce30400', 'hex').toString('base64')); // build 1251 (0x04e3)

        this.registered = true;
        this.service_thermostat = service;
        this.charac_targetTemp = service.getCharacteristic(Characteristic.TargetTemperature);
        this.charac_targetState = service.getCharacteristic(Characteristic.TargetHeatingCoolingState);

        if (this.charac_targetState.props.validValues && (this.charac_targetState.props.validValues.includes(2) || this.charac_targetState.props.validValues.includes(3))) {
          this.charac_targetState.setProps( {validValues: [0, 1]});
          this.log.warn('Only OFF and HEAT are supported for TargetHeatingCoolingState with fakegato-schedule!');
        }
      }
      else {
        this.log.warn('unknown schedule type!');
      }
    }
  
    // callback function that is bound to GET ProgramData
    cb_getProgramData(callback) {
      this.log.debug('GET ProgramData:');
      let buf = Buffer.alloc(128);
      let ofs = 0;

      // Temp Offset
      buf.writeUInt8(0x12, ofs);
      let tempOfs = Math.round(this.tempOfs * 10);
      buf.writeInt8(tempOfs, ofs+1);
      ofs += 2;

      // Enabled
      buf.writeUInt8(0x13, ofs);
      buf.writeUInt8(this.scheduleMode, ofs+1);
      ofs += 2;

      // Installation (details unclear)
      buf.writeUInt8(0x14, ofs);
      buf.writeUInt8(0xc0, ofs+1); // c0-c7
      ofs += 2;

      // Vacation Mode
      buf.writeUInt8(0x19, ofs);
      let tempVacation = this.vacationTemp ? (this.vacationTemp * 2) : 0xFF;
      buf.writeUInt8(this.vacationMode, ofs+1);
      buf.writeUInt8(tempVacation, ofs+2);
      ofs += 3;

      // Time and Date
      buf.writeUInt8(0xfc, ofs);
      let now = new Date();
      buf.writeUInt8(now.getMinutes(), ofs+1);
      buf.writeUInt8(now.getHours(), ofs+2);
      buf.writeUInt8(now.getDate(), ofs+3);
      buf.writeUInt8(now.getMonth()+1, ofs+4);
      buf.writeUInt8(now.getFullYear()%100, ofs+5);
      ofs += 6;

      // Temperature Levels
      buf.writeUInt8(0xf4, ofs);
      let tempLo = this.tempLo ? (this.tempLo * 2) : 0x80;
      let tempHi = this.tempHi ? (this.tempHi * 2) : 0x80;
      buf.writeUInt8(0x10, ofs+1); // unclear what this temperature indicates
      buf.writeUInt8(0x10, ofs+2); // unclear what this temperature indicates
      buf.writeUInt8(tempLo, ofs+3);
      buf.writeUInt8(tempHi, ofs+4);
      ofs += 5;

      // Open window
      buf.writeUInt8(0xf6, ofs);
      if (this.openWindow) {
        buf.writeUInt8(0x10, ofs+1); // this one bit is necessary
      }
      else {
        buf.writeUInt8(0x00, ofs+1);
      }
      buf.writeUInt8(0x00, ofs+2); // ?
      buf.writeUInt8(0x00, ofs+3); // ?
      ofs += 4;

      // Program (free day)
      buf.writeUInt8(0x1a, ofs);
      ofs += 1;
      buf.write(this.programFree.hex, ofs, 'hex');
      ofs += 8;

      // Program (week)
      buf.writeUInt8(0xfa, ofs);
      ofs += 1;
      buf.write(this.program1.hex, ofs, 'hex');
      ofs += 8;
      buf.write(this.program2.hex, ofs, 'hex');
      ofs += 8;
      buf.write(this.program3.hex, ofs, 'hex');
      ofs += 8;
      buf.write(this.program4.hex, ofs, 'hex');
      ofs += 8;
      buf.write(this.program5.hex, ofs, 'hex');
      ofs += 8;
      buf.write(this.program6.hex, ofs, 'hex');
      ofs += 8;
      buf.write(this.program7.hex, ofs, 'hex');
      ofs += 8;

      //17 04 0a ????

      //f3 38 19 00 00 ????

      // trim buffer
      let hexVal = buf.slice(0, ofs).toString('hex');
      buf = Buffer.from(hexVal, 'hex');

      this.log.debug(' - Data stream: %s (%d Byte)', hexVal, buf.length);
      callback(null, buf.toString('base64'));
    }

    // callback function that is bound to SET ProgramCommand
    cb_setProgramCommand(val, callback) {
      this.log.debug('SET ProgramCommand:');
      let buf = Buffer.from(val,'base64');
      let length = buf.length;
      let ofs = 0;

      // flag variables for later commands
      let setTemp = null;
      let setEnableSchedule = null;
      let setVacationMode = null;

      let hexVal = buf.toString('hex');
      this.log.debug(' - Data stream: %s', hexVal);

      // parsing data stream
      let opcode = 0;
      while (ofs < length) {
        opcode = buf.readUInt8(ofs);
        ofs += 1;
        switch(opcode) {
          case 0x00: { // Start of Command
            break;
          }
          case 0x06: { // End of Command
            break;
          }
          case 0x10: { // Remove?
            // do nothing
            this.log.debug(' - Remove');
            break;
          }
          case 0x11: { // Valve Protection
            // do nothing
            this.log.debug(' - valve protection');
            break;
          }
          case 0x12: { // Temp Offset
            this.tempOfs = buf.readInt8(ofs) / 10;
            ofs += 1;
            this.log.debug(' - Temp Ofs: %f', this.tempOfs);
            break;
          }
          case 0x13: { // Enable
            setEnableSchedule = buf.readUInt8(ofs) != 0;
            ofs += 1;
            this.log.debug(' - Enable schedule: %s', setEnableSchedule);
            break;
          }
          case 0xf4: { // Temperature Levels
            let tempNow = buf.readUInt8(ofs);
            let tempLo = buf.readUInt8(ofs+1);
            let tempHi = buf.readUInt8(ofs+2);
            setTemp = (tempNow == 0x80) ? null : (tempNow * 0.5);
            this.tempLo = (tempLo == 0x80) ? null : (tempLo * 0.5);
            this.tempHi = (tempHi == 0x80) ? null : (tempHi * 0.5);
            ofs += 3;
            tempNow = setTemp ? (setTemp.toString() + '°C') : 'NO';
            tempLo = this.tempLo ? (this.tempLo.toString() + '°C') : 'NO';
            tempHi = this.tempHi ? (this.tempHi.toString() + '°C') : 'NO';
            this.log.debug(' - Temp now: %s, Temp low: %s, Temp high: %s', tempNow, tempLo, tempHi);
            break;
          }
          case 0xfc: { // Date and Time
            let mm = leadingZeroString(buf.readUInt8(ofs));
            ofs += 1;
            let hh = leadingZeroString(buf.readUInt8(ofs));
            ofs += 1;
            let DD = leadingZeroString(buf.readUInt8(ofs));
            ofs += 1;
            let MM = leadingZeroString(buf.readUInt8(ofs));
            ofs += 1;
            let YY = leadingZeroString(buf.readUInt8(ofs));
            ofs += 1;
            // do nothing (server time should be correct)
            let dateTime = Format('%d.%d.%d %d:%d', DD, MM, YY, hh, mm);
            this.log.debug(' - Date and Time: %s', dateTime);
            break;
          }
          case 0xfa: { // Program (week)
            this.program1 = parseProgram(buf.slice(ofs, ofs+8));
            ofs += 8;
            this.program2 = parseProgram(buf.slice(ofs, ofs+8));
            ofs += 8;
            this.program3 = parseProgram(buf.slice(ofs, ofs+8));
            ofs += 8;
            this.program4 = parseProgram(buf.slice(ofs, ofs+8));
            ofs += 8;
            this.program5 = parseProgram(buf.slice(ofs, ofs+8));
            ofs += 8;
            this.program6 = parseProgram(buf.slice(ofs, ofs+8));
            ofs += 8;
            this.program7 = parseProgram(buf.slice(ofs, ofs+8));
            ofs += 8;
            this.log.debug(' - Program MO: %s', programToDisplayString(this.program1));
            this.log.debug(' - Program TU: %s', programToDisplayString(this.program2));
            this.log.debug(' - Program WE: %s', programToDisplayString(this.program3));
            this.log.debug(' - Program TH: %s', programToDisplayString(this.program4));
            this.log.debug(' - Program FR: %s', programToDisplayString(this.program5));
            this.log.debug(' - Program SA: %s', programToDisplayString(this.program6));
            this.log.debug(' - Program SU: %s', programToDisplayString(this.program7));
            break;
          }
          case 0x1a: { // Program (free day)
            this.programFree = parseProgram(buf.slice(ofs, ofs+8));
            ofs += 8;
            this.log.debug(' - Program Free: %s', programToDisplayString(this.programFree));
            break;
          }
          case 0x19: { // Vacation Mode
            setVacationMode = buf.readUInt8(ofs) != 0;
            let temp = buf.readUInt8(ofs+1);
            this.vacationTemp = (temp == 0xFF) ? null : (temp * 0.5);
            ofs += 2;
            temp = this.vacationTemp ? (this.vacationTemp.toString() + '°C') : 'OFF';
            this.log.debug(' - vacation mode: %s (%s)', setVacationMode, temp);
            break;
          }
          case 0xf2: { // ???
            let val = buf.readUInt16LE(ofs);
            ofs += 2;
            this.log.debug(' - F2: %d', val);
            break;
          }
          case 0xf6: { // ???
            this.log.debug(' - F6');
            break;
          }
          case 0x7f: { // ???
            this.log.debug(' - 7F');
            break;
          }
          case 0xff: { // ???
            let val = buf.readUInt8(ofs);
            ofs += 1;
            this.log.debug(' - FF: %d', val);
            break;
          }
          default: {
            this.log.debug(' - Unknown OpCode %s', opcode.toString(16));
            break;
          }
        }
      }

      if (setVacationMode != null) {
        this.setVacationMode(setVacationMode);
      }
      else if (setEnableSchedule === true) {
        this.enableAllSchedules(setTemp);
      }
      else if (setEnableSchedule === false) {
        this.disableAllSchedules();
      }

      callback();
    }

    disableAllSchedules() {
      this.jobs.forEach((j) => {
        j.cancel();
      });
      this.jobs = [];

      this.scheduleMode = false;
      this.log.debug('Schedule disabled');
    }
    
    enableAllSchedules(tempNow) {
      this.jobs.forEach((j) => {
        j.cancel();
      });
      this.jobs = [];

      if (tempNow) {
        // set HomeKit characteristic "TargetTemperature" to new temperature
        this.charac_targetTemp.setValue(tempNow, null, 'schedule enabled');
        // set HomeKit characteristic "TargetHeatingCoolingState" to HEAT
        this.charac_targetState.setValue(Characteristic.TargetHeatingCoolingState.HEAT, null, 'schedule enabled');
      }

      this.enableSchedule(this.program1, 1); // MO
      this.enableSchedule(this.program2, 2); // TU
      this.enableSchedule(this.program3, 3); // WE
      this.enableSchedule(this.program4, 4); // TH
      this.enableSchedule(this.program5, 5); // FR
      this.enableSchedule(this.program6, 6); // SA
      this.enableSchedule(this.program7, 7); // SU

      this.scheduleMode = true;
      this.log.debug('Schedule enabled');
    }

    enableSchedule(program, day) {
      const setTempHiFunc = () => {
        // set HomeKit characteristic "TargetTemperature" to high temperature
        this.charac_targetTemp.setValue(this.tempHi, null, 'schedule');
        // set HomeKit characteristic "TargetHeatingCoolingState" to HEAT
        this.charac_targetState.setValue(Characteristic.TargetHeatingCoolingState.HEAT, null, 'schedule');
        this.log.debug('Schedule event: Start of heating period (set to %d°C)', this.tempHi);
      };
      const setTempLoFunc = () => {
        // set HomeKit characteristic "TargetTemperature" to low temperature
        this.charac_targetTemp.setValue(this.tempLo, null, 'schedule');
        // set HomeKit characteristic "TargetHeatingCoolingState" to HEAT
        this.charac_targetState.setValue(Characteristic.TargetHeatingCoolingState.HEAT, null, 'schedule');
        this.log.debug('Schedule event: End of heating period (set to %d°C)', this.tempLo);
      };

      if (!Array.isArray(program.periods)) {
        return;
      }
      program.periods.forEach((period) => {
        this.jobs.push( scheduler.scheduleJob(Format('%d %d * * %d', period.strMinute, period.strHour, day), setTempHiFunc) );
        this.jobs.push( scheduler.scheduleJob(Format('%d %d * * %d', period.endMinute, period.endHour, day), setTempLoFunc) );
      });
    }

    setVacationMode(enable, temperature) {
      if (enable) {
        if (!this.vacationMode) {
          // save last target temp and schedule mode before vacation mode
          this.tempBeforeVacation = this.charac_targetTemp.value;
          this.scheduleModeBeforeVacation = this.scheduleMode;
        }
        if (temperature) { // external call
          this.vacationTemp = temperature;
        }
        // set HomeKit characteristic "TargetTemperature" to vacation temperature
        this.charac_targetTemp.setValue(this.vacationTemp, null, 'vacation mode');
        this.log.debug('Vacation Mode enabled (set to %d°C)', this.vacationTemp);
        this.disableAllSchedules();
      }
      else if (this.vacationMode) { // disable
        // set HomeKit characteristic "TargetTemperature" to old value
        this.charac_targetTemp.setValue(this.tempBeforeVacation, null, 'vacation mode'); 
        this.log.debug('Vacation Mode disabled (set to %d°C)', this.tempBeforeVacation);
        if (this.scheduleModeBeforeVacation) {
          this.enableAllSchedules();
        }
      }
      this.vacationMode = enable;
      // always set HomeKit characteristic "TargetHeatingCoolingState" to HEAT
      this.charac_targetState.setValue(Characteristic.TargetHeatingCoolingState.HEAT, null, 'vacation mode');
    }

    setOpenWindow(open, offTime=1800000) {
      if (open && !this.openWindow && this.charac_targetState.value != Characteristic.TargetHeatingCoolingState.OFF) {
        this.scheduleModeBeforeOpenWindow = this.scheduleMode;
        // set HomeKit characteristic "TargetHeatingCoolingState" to OFF
        this.charac_targetState.setValue(Characteristic.TargetHeatingCoolingState.OFF, null, 'open window');
        this.log.debug('Open window (set OFF)');
        this.disableAllSchedules();

        // switch back to HEAT after offTime (default: 30min)
        this.openWindowTimer = setTimeout(() => {
          // set HomeKit characteristic "TargetHeatingCoolingState" back to HEAT
          this.charac_targetState.setValue(Characteristic.TargetHeatingCoolingState.HEAT, null, 'open window timeout');
          this.log.debug('Open window timeout (set ON)');
          if (this.scheduleModeBeforeOpenWindow) {
            this.enableAllSchedules();
          }
          this.openWindow = false;
          this.openWindowTimer = null;
        }, offTime);
      }
      else if (!open && this.openWindowTimer) {
        clearTimeout(this.openWindowTimer);
        this.openWindowTimer = null;
        // set HomeKit characteristic "TargetHeatingCoolingState" back to HEAT
        this.charac_targetState.setValue(Characteristic.TargetHeatingCoolingState.HEAT, null, 'closed window');
        this.log.debug('Closed window timeout (set ON)');
        if (this.scheduleModeBeforeOpenWindow) {
          this.enableAllSchedules();
        }
      }
      this.openWindow = open;
    }
  }

	return FakeGatoSchedule;
};
