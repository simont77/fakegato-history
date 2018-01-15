/*jshint esversion: 6,node: true,-W041: false */
'use strict';

const DEBUG = true;
var debug = require('debug')('FakeGatoStorage');
var fs = require('fs');
var os = require('os');

class FakeGatoStorage {
	constructor(params) {
		if (!params)
			params = {};
		
		this.storage = params.storage || 'fs';
		
		this.log = params.log || {};
		if (!params.log || !params.log.debug) {
			if(DEBUG) this.log.debug = console.log;
			else this.log.debug = function(){};
		}
		
		switch(this.storage) {
			case 'fs' :
				this.storageHandler = fs;
				this.path = params.path || os.homedir()+'/.homebridge/';
				this.log.debug('***StoragePath***',this.path);
			break;
			case 'googleDrive' :
			
			break;
			/*
			case 'memcached' :
			
			break;
			*/
		}

		
	}
	
	write(key,data) {
		
	}
	read(key){
		
	}
}

module.exports = {
	FakeGatoStorage: FakeGatoStorage
};
