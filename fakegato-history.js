'use strict';

var homebridge;
var Characteristic;

module.exports = function(pHomebridge) {
	if (pHomebridge && !homebridge) {
		homebridge = pHomebridge;
		Characteristic = homebridge.hap.Characteristic;
    }
    
    var hexToBase64 = function(val) {
        return new Buffer((''+val).replace(/[^0-9A-F]/ig, ''), 'hex').toString('base64');
    }, base64ToHex = function(val) {
        if(!val) return val;
        return new Buffer(val, 'base64').toString('hex');
    }, swap16 = function (val) {
        return ((val & 0xFF) << 8)
            | ((val >>> 8) & 0xFF);
    }, swap32 = function (val) {
        return ((val & 0xFF) << 24)
           | ((val & 0xFF00) << 8)
           | ((val >>> 8) & 0xFF00)
           | ((val >>> 24) & 0xFF);
    },	hexToHPA = function(val) {
        return parseInt(swap16(val), 10);
    }, hPAtoHex = function(val) {
        return swap16(Math.round(val)).toString(16);
    }, numToHex = function(val, len) {
        var s = Number(val>>>0).toString(16);
        if(s.length % 2 != 0) {
            s = '0' + s;
        }
        if(len) {
            return ('0000000000000' + s).slice(-1 * len);
        }
    return s;
}

    class S2R1Characteristic extends Characteristic {
        constructor() {
            super('S2R1', 'E863F116-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.DATA,
                perms: [
                    Characteristic.Perms.READ, Characteristic.Perms.NOTIFY
                ]
            });
        }
    }

    class S2R2Characteristic extends Characteristic {
        constructor() {
            super('S2R2', 'E863F117-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.DATA,
                perms: [
                    Characteristic.Perms.READ, Characteristic.Perms.NOTIFY
                ]
            });
        }
    }

    class S2W1Characteristic extends Characteristic {
        constructor() {
            super('S2W1', 'E863F11C-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.DATA,
                perms: [
                    Characteristic.Perms.WRITE
                ]
            });
        }
    }

    class S2W2Characteristic extends Characteristic {
        constructor() {
            super('S2W2', 'E863F121-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.DATA,
                perms: [
                    Characteristic.Perms.WRITE
                ]
            });
        }
    }

    class FakeGatoHistoryService extends homebridge.hap.Service {
        constructor(accessoryType) {
            super("History", 'E863F007-079E-48FF-8F27-9C2605A29F52');
            switch (accessoryType)
            {
                case "weather":
                    this.accessoryType116 = "03";
                    this.accessoryType117 = "07";
                    break;
                case "energy":
                    this.accessoryType116 = "07";
                    this.accessoryType117 = "1f";
                    break;
                case "room":
                    this.accessoryType116 = "04";
                    this.accessoryType117 = "0f";
                    break;
            }
            
            
            this.accessoryType=accessoryType;
            this.nextAvailableEntry = 1;
            this.history = [];
            this.maxHistory = 100;
            this.currentEntry = 1;
            this.transfer=false;
            this.setTime=true;
            this.refTime=0;

            this.addCharacteristic(S2R1Characteristic);
                
            this.addCharacteristic(S2R2Characteristic)
                .on('get', (callback) => {
                    if ((this.currentEntry<this.nextAvailableEntry) && (this.transfer==true))
                    {
                        
                        if ((this.history[this.currentEntry].temp==0 &&
                            this.history[this.currentEntry].pressure==0 &&
                            this.history[this.currentEntry].humidity==0) || (this.history[this.currentEntry].power==0xFFFF) || (this.setTime==true))
                        {	
                            console.log("Data "+ this.accessoryType + ": 15" + numToHex(swap16(this.currentEntry),4) + "0000 0000 0000 81" + numToHex(swap32(this.refTime),8) +"0000 0000 00 0000");
                            callback(null,hexToBase64('15' + numToHex(swap16(this.currentEntry),4) +' 0000 0000 0000 81' + numToHex(swap32(this.refTime),8) + '0000 0000 00 0000'));
                            this.setTime=false;
                        }
                        else
                            switch (this.accessoryType)
                            {
                                case "weather":
                            	    console.log("Data "+ this.accessoryType + ": 10 " + numToHex(swap16(this.currentEntry),4) + " 0000 "
                                            + numToHex(swap32(this.history[this.currentEntry].time-this.refTime-978307200),8)
                                            + this.accessoryType117
                                            + numToHex(swap16(this.history[this.currentEntry].temp*100),4) 
                                            + numToHex(swap16(this.history[this.currentEntry].humidity*100),4) 
                                            + numToHex(swap16(this.history[this.currentEntry].pressure*10),4));
                                    callback(null,hexToBase64('10' + numToHex(swap16(this.currentEntry),4)+ ' 0000 ' 
                                            + numToHex(swap32(this.history[this.currentEntry].time-this.refTime-978307200),8) 
                                            + this.accessoryType117
                                            + numToHex(swap16(this.history[this.currentEntry].temp*100),4) 
                                            + numToHex(swap16(this.history[this.currentEntry].humidity*100),4) 
                                            + numToHex(swap16(this.history[this.currentEntry].pressure*10),4)));
                                    break;
                                case "energy":
                            	    console.log("Data "+ this.accessoryType + ": 14 " + numToHex(swap16(this.currentEntry),4) + " 0000 "
                                            + numToHex(swap32(this.history[this.currentEntry].time-this.refTime-978307200),8)
                                            + this.accessoryType117
                                            + "0000 0000" 
                                            + numToHex(swap16(this.history[this.currentEntry].power*10),4) 
                                            + "0000 0000");
                                    callback(null,hexToBase64('14' + numToHex(swap16(this.currentEntry),4)+ ' 0000 ' 
                                            + numToHex(swap32(this.history[this.currentEntry].time-this.refTime-978307200),8) 
                                            + this.accessoryType117
                                            + "0000 0000" 
                                            + numToHex(swap16(this.history[this.currentEntry].power*10),4) 
                                            + "0000 0000"));
                                    break;
                            }
                        this.currentEntry++;
                    }
                    else
                    {
                        this.transfer=false;
                        callback(null,hexToBase64('00'));
                    }
                    
            });	
            
                
            this.addCharacteristic(S2W1Characteristic)
                .on('set', this.setCurrentS2W1.bind(this));
                
            this.addCharacteristic(S2W2Characteristic)
                .on('set', this.setCurrentS2W2.bind(this));

            
        }

        sendHistory(address){
            var hexAddress= address.toString('16');
            if (address!=0)
                this.currentEntry = address;
            else
                this.currentEntry = 1;
            this.transfer=true;
        }
        
        //in order to be consistent with Eve, entry address start from 1
        addEntry(entry){
            if (this.nextAvailableEntry<this.maxHistory)
            {
                if (this.refTime==0)
                {
                    this.refTime=entry.time-978307200;
                    switch (this.accessoryType)
                        {
                            case "weather":
                                this.history[this.nextAvailableEntry]= {time: entry.time, temp:0, pressure:0, humidity:0};
                                break;
                            case "energy":
                                this.history[this.nextAvailableEntry]= {time: entry.time, power:0xFFFF};
                                break;
                        }
                    this.nextAvailableEntry++;
                }
                this.history[this.nextAvailableEntry] = (entry);
                this.nextAvailableEntry++;
            }
            else
            {
                this.history[1] = (entry);
                this.nextAvailableEntry = 2;
            }

            this.getCharacteristic(S2R1Characteristic)
                .setValue(hexToBase64(numToHex(swap32(entry.time-this.refTime-978307200),8) + '00000000' + numToHex(swap32(this.refTime),8) + '0401020202' + this.accessoryType116 +'020f03' + numToHex(swap16(this.nextAvailableEntry),4) +'ed0f00000000000000000101'));
            console.log("Next available entry " + this.accessoryType + ": " + this.nextAvailableEntry.toString(16));
            console.log("116 " + this.accessoryType + ": " + numToHex(swap32(entry.time-this.refTime-978307200),8) + '00000000' + numToHex(swap32(this.refTime),8) + '0401020202' + this.accessoryType116 +'020f03' + numToHex(swap16(this.nextAvailableEntry),4) +'ed0f00000000000000000101');

        }
        
        setCurrentS2W1(val, callback) {
            callback(null,val);
            console.log("Data request " + this.accessoryType + ": "+ base64ToHex(val));
            var valHex = base64ToHex(val);
            var substring = valHex.substring(4,12);
            var valInt = parseInt(substring,16);
            var address = swap32(valInt);
            var hexAddress= address.toString('16');

            console.log("Address requested " + this.accessoryType + ": "+ hexAddress);
            if (this.transfer==false)
            {
                //this.transfer=true;
                this.sendHistory(address);
            }
        }
        
        setCurrentS2W2(val, callback) {
            console.log("Clock adjust: "+ base64ToHex(val));
            callback(null,val);
        }

        
    }

    return FakeGatoHistoryService;
}