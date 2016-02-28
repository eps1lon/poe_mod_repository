/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
(function (__undefined) {
    'use strict';
    
    var assert = require('assert');
    
    var src_path = require("./src_path");
    var Item = require(src_path + "/ModContainers/Item");
    
    var tests = [
        function () {
            for (var i in Item.ITEMCLASSES) {
                console.log(i);
                return true;
            }
            return false;
        }
    ];
    
    tests.forEach(function (test) {
        console.log(test());
    });
}).call(this);