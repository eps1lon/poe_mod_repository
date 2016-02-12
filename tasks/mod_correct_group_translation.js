/* global Mod, Stat */

(function (window, __undefined) {
    'use strict';
    
    var fs = require('fs');
    
    require('../js/libs/Localization');
    require('../js/libs/mods/Mod');
    require('../js/libs/Stat');
    require('../js/libs/jquery/jquery_node');

    var MOD_CORRECT_GROUP_TRANSLATION_FILE = '../js/data/translations/English/mod_correct_groups.json';
    
    // init
    Mod.mods = require('../js/data/mods');
    
    Mod.all_stats = require('../js/data/stats');
    Mod.localization = new Localization(require('../js/data/translations/English/stat_descriptions.json'));
    Mod.correct_group_localization = require(MOD_CORRECT_GROUP_TRANSLATION_FILE);
 
    var mods = Mod.mods.map(function (props) {
                    return new Mod(props);
                }).filter(function (mod) {
                    return mod.isAffix();
                });
    
    mods.forEach(function (mod) {
        var t_key = mod.getProp("CorrectGroup"); 
        var stats = mod.statsJoined();
        
        var stat_templates = $.unique($.map(stats, function (stat) {
            var t_params = stat.tParams(stats, Mod.localization);
            var template_string = Mod.localization.lookupString(stat.getProp("Id"), 
                                                                t_params);
                                    
            if (template_string === null) {
                return null; // filter!
            }
            
            var human_string = template_string.replace(/\{param_\d+\}/g, '#');
            return human_string;                                                    
        }));
        
        Mod.correct_group_localization[t_key] = stat_templates.join("\n");
    });
    
    fs.writeFile(MOD_CORRECT_GROUP_TRANSLATION_FILE, 
                 JSON.stringify(Mod.correct_group_localization, null, 4),
                 'utf8',
                 function (e) {
                     console.log(e);
                 });
})(this);