/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
(function (__undefined) {
    'use strict';
    
    var assert = require('assert');
    
    var src_path = require("./src_path");
    
    var ByteSet = require(src_path + "/ByteSet");
    
    var initial_value = 3;
    var byte_set = new ByteSet(["bit1", "bit2", "bit3"]);
    byte_set.value = initial_value;
    
    var tests = [
        function () {
            // test exists
            assert.equal(byte_set.exists("bit2"), true);
            assert.equal(byte_set.exists("bit4"), false);
            
            return true;
        },
        function () {
            // test add
            byte_set.add("bit4");
            assert.equal(byte_set.exists("bit4"), true);
            
            return true;
        },
        function () {
            // test isSet
            assert.equal(byte_set.isSet("bit1"), true);
            assert.equal(byte_set.isSet("bit2"), true);
            assert.equal(byte_set.isSet("bit3"), false);
            
            return true;
        },
        function () {
            // test enable
            byte_set.enable("bit3");
            assert.equal(byte_set.isSet("bit1"), true);
            assert.equal(byte_set.isSet("bit2"), true);
            assert.equal(byte_set.isSet("bit3"), true);
            assert.equal(byte_set.value, 7);
            
            byte_set.value = initial_value;
            return true;
        },
        function () {
            // test disabl
            byte_set.disable("bit2");
            
            assert.equal(byte_set.isSet("bit1"), true);
            assert.equal(byte_set.isSet("bit2"), false);
            assert.equal(byte_set.value, 1);
            
            byte_set.value = initial_value;
            return true;
        }, 
        function () {
            // test isSet(byte)
            assert.deepEqual(byte_set.isSet(), {"bit1": true, "bit2": true, "bit3": false, "bit4": false});
            
            return true;
        }
    ]; 
    
    tests.forEach(function (test, i) {
        console.log(i, test());
    });
}).call(this);