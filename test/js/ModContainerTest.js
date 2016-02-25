(function (__undefined) {
    'use strict';
    var assert = require("assert");
    
    var src_path = require("./src_path");
    var ModContainer = require(src_path + "/ModContainers/ModContainer");
    
    var mc_1 = new ModContainer();
    
    assert.equal(0, mc_1.mods.length);
}).call(this);