/*jshint esversion: 6,node: true,-W041: false */
'use strict';

const DEBUG = true;
var debug = require('debug')('FakeGatoStorage');
var fs = require('fs');
var os = require('os');

var fileSuffix = '_persist.json';

class FakeGatoStorage {
	constructor(params) {
		if (!params)
			params = {};
		
		this.writers = [];
		
		this.log = params.log || {};
		if (!params.log || !params.log.debug) {
			if(DEBUG) this.log.debug = console.log;
			else this.log.debug = function(){};
		}
	}
	
	addWriter(service,params) {
		if (!params)
			params = {};
		
		this.log.debug("** Fakegato-storage AddWriter :",service.accessoryName);
		
		let newWriter = {
			'service': service,
			'callback': params.callback,
			'storage' : params.storage || 'fs',
			'path'    : '',
			'storageHandler': null
		};

		switch(newWriter.storage) {
			case 'fs' :
				newWriter.storageHandler = fs;
				newWriter.path = params.path || os.homedir()+'/.homebridge/';
			break;
			case 'googleDrive' :
			
			break;
			/*
			case 'memcached' :
			
			break;
			*/
		}
		this.writers.push(newWriter);
	}
	getWriter(service) {
		let findServ = function (element) {
			return element.service === service;
		};
		return this.writers.find(findServ);
	}
	_getWriterIndex(service) {
		let findServ = function (element) {
			return element.service === service;
		};
		return this.writers.findIndex(findServ);
	}
	getWriters() {
		return this.writers;
	}
	delWriter(service) {
		let index = this._getWriterIndex(service);
		this.writers.splice(index, 1);
	}
	
	write(params) { // must be asynchronous
		this.log.debug("** Fakegato-storage write :",params.service.accessoryName,params.data);
		let writer = this.getWriter(params.service);
		switch(writer.storage) {
			case 'fs' :
				writer.storageHandler.writeFile(writer.path+writer.service.accessoryName+fileSuffix,params.data,'utf8',typeof(params.callback)=='function'?params.callback:(typeof(writer.callback)=='function'?writer.callback:function(){}));
			break;
			case 'googleDrive' :
			
			break;
			/*
			case 'memcached' :
			
			break;
			*/
		}
	}
	read(params){ // must by synchronous
		let writer = this.getWriter(params.service);
		switch(writer.storage) {
			case 'fs' :
				if(writer.storageHandler.existsSync(writer.path+params.service.accessoryName+fileSuffix)) {
					let data = writer.storageHandler.readFileSync(writer.path+params.service.accessoryName+fileSuffix,'utf8');
					this.log.debug("** Fakegato-storage FS read :",params.service.accessoryName,data);
					return data;
				} else {
					return null;
				}
			break;
			case 'googleDrive' :
			
			break;
			/*
			case 'memcached' :
			
			break;
			*/
		}
	}
}

module.exports = {
	FakeGatoStorage: FakeGatoStorage
};
