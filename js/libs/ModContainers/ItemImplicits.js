/* global ModContainer, Mod */

(function (__undefined) {
    /**
     * class ItemImplicits extends ModContainer
     * 
     * holds all implicits for items
     */
    this.ItemImplicits = ModContainer.extend({
        /**
         * 
         * @param {Mod} mod
         * @returns {Boolean} true on success
         */
        addMod: function (mod) {
            if (!(mod instanceof Mod)) {
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
            if  (+mod.getProp("GenerationType") === Mod.MOD_TYPE.PREMADE) {
                return 1;
            }
            return -1;
        }
    });
})();