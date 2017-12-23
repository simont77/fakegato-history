'use strict';

var homebridge;
var Characteristic, Service;

module.exports = function(pHomebridge) {
	if (pHomebridge && !homebridge) {
		homebridge = pHomebridge;
		Characteristic = homebridge.hap.Characteristic;
		Service = homebridge.hap.Service;
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
                    Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.HIDDEN
                ]
            });
        }
    }

    S2R1Characteristic.UUID = 'E863F116-079E-48FF-8F27-9C2605A29F52';

    class S2R2Characteristic extends Characteristic {
        constructor() {
            super('S2R2', 'E863F117-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.DATA,
                perms: [
                    Characteristic.Perms.READ, Characteristic.Perms.NOTIFY, Characteristic.Perms.HIDDEN
                ]
            });
        }
    }

    S2R2Characteristic.UUID = 'E863F117-079E-48FF-8F27-9C2605A29F52';

    class S2W1Characteristic extends Characteristic {
        constructor() {
            super('S2W1', 'E863F11C-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.DATA,
                perms: [
                    Characteristic.Perms.WRITE, Characteristic.Perms.HIDDEN
                ]
            });
        }
    }

    S2W1Characteristic.UUID = 'E863F11C-079E-48FF-8F27-9C2605A29F52';

    class S2W2Characteristic extends Characteristic {
        constructor() {
            super('S2W2', 'E863F121-079E-48FF-8F27-9C2605A29F52');
            this.setProps({
                format: Characteristic.Formats.DATA,
                perms: [
                    Characteristic.Perms.WRITE, Characteristic.Perms.HIDDEN
                ]
            });
        }
    }

    S2W2Characteristic.UUID = 'E863F121-079E-48FF-8F27-9C2605A29F52';

    class FakeGatoHistoryService extends Service {
        constructor(accessoryType, accessory, size) {
            if (typeof size === 'undefined') { size = 4032; }
            
            super(accessory.displayName + " History", 'E863F007-079E-48FF-8F27-9C2605A29F52');

            var entry2address = function(val) {
                var temp = val % this.memorySize;
                return temp;
            }.bind(this);

            this.log = accessory.log;
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
            this.firstEntry = 0;
            this.lastEntry = 0;
            this.history = [];
            this.memorySize = size;
            this.usedMemory=0;
            this.currentEntry = 1;
            this.transfer=false;
            this.setTime=true;
            this.refTime=0;
            this.memoryAddress=0;
            this.dataStream='';

            this.addCharacteristic(S2R1Characteristic);
                
            this.addCharacteristic(S2R2Characteristic)
                .on('get', (callback) => {
                    if ((this.currentEntry<this.lastEntry) && (this.transfer==true))
                    {
                        this.memoryAddress = entry2address (this.currentEntry);

                        if ((this.history[this.memoryAddress].temp==0 &&
                            this.history[this.memoryAddress].pressure==0 &&
                            this.history[this.memoryAddress].humidity==0) || (this.history[this.memoryAddress].power==0xFFFF) || (this.setTime==true))
                        {	
                            this.log.debug("Data "+ this.accessoryType + ": 15" + numToHex(swap16(this.currentEntry),4) + "0000 0000 0000 81" + numToHex(swap32(this.refTime),8) +"0000 0000 00 0000");
                            callback(null,hexToBase64('15' + numToHex(swap16(this.currentEntry),4) +' 0000 0000 0000 81' + numToHex(swap32(this.refTime),8) + '0000 0000 00 0000'));
                            this.setTime=false;
                            this.currentEntry++;
                        }
                        else
                        {    
                            for (var i=0;i<11;i++)
                            { 
                                switch (this.accessoryType)
                                {
                                    case "weather":
                                        this.log.debug(this.accessoryType + " Entry: " + this.currentEntry + ", Address: " + this.memoryAddress);
                                        this.dataStream = this.dataStream + " 10 " + numToHex(swap16(this.currentEntry),4) + " 0000 "
                                            + numToHex(swap32(this.history[this.memoryAddress].time-this.refTime-978307200),8)
                                            + this.accessoryType117
                                            + numToHex(swap16(this.history[this.memoryAddress].temp*100),4) 
                                            + numToHex(swap16(this.history[this.memoryAddress].humidity*100),4) 
                                            + numToHex(swap16(this.history[this.memoryAddress].pressure*10),4);
                                        break;
                                    case "energy":
                                        this.log.debug(this.accessoryType + " Entry: " + this.currentEntry + ", Address: " + this.memoryAddress);
                                        this.dataStream = this.dataStream + " 14 " + numToHex(swap16(this.currentEntry),4) + " 0000 "
                                                + numToHex(swap32(this.history[this.memoryAddress].time-this.refTime-978307200),8)
                                                + this.accessoryType117
                                                + "0000 0000" 
                                                + numToHex(swap16(this.history[this.memoryAddress].power*10),4) 
                                                + "0000 0000";
                                        break;
                                }
                                this.currentEntry++;
                                this.memoryAddress = entry2address (this.currentEntry);
                                if (this.currentEntry==this.lastEntry)
                                {
                                    break;
                                }
                            }
                            this.log.debug("Data " + this.accessoryType + ": " + this.dataStream);
                            callback(null,hexToBase64(this.dataStream));
                            this.dataStream='';
                        }                        
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

            var entry2address = function(val) {
                return val % this.memorySize;
            }.bind(this);   

            if (this.usedMemory<this.memorySize)
            {
                this.usedMemory++;
                this.firstEntry=0;
                this.lastEntry=this.usedMemory;
            } 
            else
            {
                this.firstEntry++;
                this.lastEntry = this.firstEntry+this.usedMemory;
            }
            
            if (this.refTime==0)
                {
                    this.refTime=entry.time-978307200;
                    switch (this.accessoryType)
                        {
                            case "weather":
                                this.history[this.lastEntry]= {time: entry.time, temp:0, pressure:0, humidity:0};
                                break;
                            case "energy":
                                this.history[this.lastEntry]= {time: entry.time, power:0xFFFF};
                                break;
                        }
                    this.lastEntry++;
                    this.usedMemory++;
                }
            
            this.history[entry2address(this.lastEntry)] = (entry);

            this.getCharacteristic(S2R1Characteristic)
                .setValue(hexToBase64(numToHex(swap32(entry.time-this.refTime-978307200),8) + '00000000' + numToHex(swap32(this.refTime),8) + '0401020202' + this.accessoryType116 +'020f03' + numToHex(swap16(this.usedMemory),4) + numToHex(swap16(this.memorySize),4) + numToHex(swap32(this.firstEntry),8) + '000000000101'));
            this.log.debug("First entry " + this.accessoryType + ": " + this.firstEntry.toString(16));
            this.log.debug("Last entry " + this.accessoryType + ": " + this.lastEntry.toString(16));
            this.log.debug("Used memory " + this.accessoryType + ": " + this.usedMemory.toString(16));
            this.log.debug("116 " + this.accessoryType + ": " + numToHex(swap32(entry.time-this.refTime-978307200),8) + '00000000' + numToHex(swap32(this.refTime),8) + '0401020202' + this.accessoryType116 +'020f03 ' + numToHex(swap16(this.usedMemory),4) + numToHex(swap16(this.memorySize),4) + numToHex(swap32(this.firstEntry),8) + '000000000101');

        }
        
        setCurrentS2W1(val, callback) {
            callback(null,val);
            this.log.debug("Data request " + this.accessoryType + ": "+ base64ToHex(val));
            var valHex = base64ToHex(val);
            var substring = valHex.substring(4,12);
            var valInt = parseInt(substring,16);
            var address = swap32(valInt);
            var hexAddress= address.toString('16');

            this.log.debug("Address requested " + this.accessoryType + ": "+ hexAddress);
            //if (this.transfer==false)
            {
                //this.transfer=true;
                this.sendHistory(address);
            }
        }
        
        setCurrentS2W2(val, callback) {
            this.log.debug("Clock adjust: "+ base64ToHex(val));
            callback(null,val);
        }

        
    }

    FakeGatoHistoryService = 'E863F007-079E-48FF-8F27-9C2605A29F52';

    return FakeGatoHistoryService;
}
