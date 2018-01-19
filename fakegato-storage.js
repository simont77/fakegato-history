/*jshint esversion: 6,node: true,-W041: false */
'use strict';

const DEBUG = true;
var debug = require('debug')('FakeGatoStorage');
var fs = require('fs');
var os = require('os');

var googleDrive = require('./lib/googleDrive').drive;

var fileSuffix = '_persist.json';

var thisStorage;

class FakeGatoStorage {
	constructor(params) {
		if (!params)
			params = {};
		
		this.writers = [];
		
		this.log = params.log || {};
		if (!this.log.debug) {
			this.log.debug = DEBUG ? console.log : function() {};
		}
		thisStorage=this;
	}
	
	addWriter(service,params) {
		if (!params)
			params = {};
		
		this.log.debug("** Fakegato-storage AddWriter :",service.accessoryName);
		
		let newWriter = {
			'service': service,
			'callback': params.callback,
			'storage' : params.storage || 'fs'
		};
		var onReady = typeof(params.onReady) == 'function' ? params.onReady:function(){}.bind(this);

		switch(newWriter.storage) {
			case 'fs' :
				newWriter.storageHandler = fs;
				newWriter.path = params.path || os.homedir()+'/.homebridge/';
				this.writers.push(newWriter);
				onReady.call();
			break;
			case 'googleDrive' :
				newWriter.path = params.path || 'fakegato';
				newWriter.keyPath = params.keyPath || os.homedir()+'/.homebridge/';
				newWriter.storageHandler = new googleDrive({keyPath:newWriter.keyPath,callback:onReady});
				this.writers.push(newWriter);
			break;
			/*
			case 'memcached' :
			
			break;
			*/
		}
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
		let writer = this.getWriter(params.service);
		let callBack = typeof(params.callback)=='function'?params.callback:(typeof(writer.callback)=='function'?writer.callback:function(){}); // use parameter callback or writer callback or empty function
		switch(writer.storage) {
			case 'fs' :
				this.log.debug("** Fakegato-storage write FS :",writer.path+writer.service.accessoryName+fileSuffix,params.data);
				writer.storageHandler.writeFile(writer.path+writer.service.accessoryName+fileSuffix,params.data,'utf8',callBack);
			break;
			case 'googleDrive' :
				this.log.debug("** Fakegato-storage write googleDrive :",writer.path,writer.service.accessoryName+fileSuffix,params.data);
				writer.storageHandler.writeFile(writer.path,writer.service.accessoryName+fileSuffix,params.data,callBack);
			break;
			/*
			case 'memcached' :
			
			break;
			*/
		}
	}
	read(params){
		let writer = this.getWriter(params.service);
		let callBack = typeof(params.callback)=='function'?params.callback:(typeof(writer.callback)=='function'?writer.callback:function(){}); // use parameter callback or writer callback or empty function
		switch(writer.storage) {
			case 'fs' :
				this.log.debug("** Fakegato-storage read FS :",writer.path+writer.service.accessoryName+fileSuffix);
				writer.storageHandler.readFile(writer.path+writer.service.accessoryName+fileSuffix,'utf8',callBack);	
			break;
			case 'googleDrive' :
				this.log.debug("** Fakegato-storage read googleDrive :",writer.service.accessoryName+fileSuffix);
				writer.storageHandler.readFile(writer.path,writer.service.accessoryName+fileSuffix,callBack);
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
