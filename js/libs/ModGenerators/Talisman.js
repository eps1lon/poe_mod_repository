(function (__undefined) {
    var ModGenerator = require('./ModGenerator');
    var Mod = require('../mods/Mod');
    
    /**
     * TODO
     */
    var Talisman = ModGenerator.extend({
        init: function () {
            
        }
    });
    
    Talisman.mod_filter = function (mod_props) {
        // talisman wildcard
        return [Mod.MOD_TYPE.ENCHANTMENT].indexOf(+mod_props.GenerationType) !== -1;
    };
    
    module.exports = Talisman;
}).call(this);