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
    
    var byte_set = new ByteSet(["bit1", "bit2", "bit3"]);
    
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
            var byte = 3;
            assert.equal(byte_set.isSet(byte, "bit1"), true);
            assert.equal(byte_set.isSet(byte, "bit2"), true);
            assert.equal(byte_set.isSet(byte, "bit3"), false);
            
            return true;
        },
        function () {
            // test enable
            var byte = 3;
            byte = byte_set.enable(byte, "bit3");
            assert.equal(byte_set.isSet(byte, "bit1"), true);
            assert.equal(byte_set.isSet(byte, "bit2"), true);
            assert.equal(byte_set.isSet(byte, "bit3"), true);
            assert.equal(byte, 7);
            
            return true;
        },
        function () {
            // test disable
            var byte = 3;
            byte = byte_set.disable(byte, "bit2");
            
            assert.equal(byte_set.isSet(byte, "bit1"), true);
            assert.equal(byte_set.isSet(byte, "bit2"), false);
            assert.equal(byte, 1);
            
            return true;
        }, 
        function () {
            // test isSet(byte)
            var byte = 3;
            
            assert.deepEqual(byte_set.isSet(byte), {"bit1": true, "bit2": true, "bit3": false, "bit4": false});
            
            return true;
        }
    ]; 
    
    tests.forEach(function (test, i) {
        console.log(i, test());
    });
}).call(this);