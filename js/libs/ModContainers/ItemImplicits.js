(function (__undefined) {
    var ModContainer = require("./ModContainer");
    var Mod = require('../mods/Mod');
    
    /**
     * class ItemImplicits extends ModContainer
     * 
     * holds all implicits for items
     */
    var ItemImplicits = ModContainer.extend({
        /**
         * 
         * @param {Mod} mod
         * @returns {Boolean} true on success
         */
        addMod: function (mod) {
            if (!(mod instanceof Mod)) {
                console.error('mod must be instance of `Mod`');
                return false;
            }
            
            if (this.hasRoomFor(mod)) {
                return this._super(mod);
            }
            return false;
        },
        /**
         * 
         * @param {Mod} mod
         * @returns {Number} -1 if not possible at all
         */
        maxModsOfType: function (mod) {
            var generation_type = +mod.getProp("GenerationType");
            if  (generation_type === Mod.MOD_TYPE.PREMADE) {
                return 5;
            } else if (generation_type === Mod.MOD_TYPE.ENCHANTMENT) {
                return 1;
            } else if (generation_type === Mod.MOD_TYPE.VAAL) {
                return 1;
            }
            return -1;
        }
    });
    
    module.exports = ItemImplicits;
}).call(this);