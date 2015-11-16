(function (__undefined) {
    /*
     * Item Class
     * require ModContainer
     */
    this.Item = ModContainer.extend({
        init: function () {
            this._super();
            this.rarity = Item.rarity.NORMAL;
            // what items have a default tag?
            this.tags = [];
        },
        addMod: function (mod) {
            if (!(mod instanceof Mod)) {
                return false;
            }
            
            if (mod.isPrefix() && this.prefixes().length < this.maxPrefixes()
                || mod.isSuffix() && this.suffixes().length < this.maxSuffixes()
                || mod.isImplicit() && this.implicits().length < this.maxImplicits()
            ) {
                return this._super(mod);
            }
            return false;
        },
        removeMod: function (mod) {
            return this._super(mod);
        },
        addTag: function (tag_key) {
            if (this.tags.indexOf(tag_key) === -1) {
                this.tags.push(tag_key);
                return true;
            }
            return false;
        },
        removeTag: function (tag_key) {
            var index = this.tags.indexOf(tag_key);
            if (index !== -1) {
                this.tags = this.tags.splice(index, 1);
                return tag_key;
            }
            return false;
        },
        /**
         * returns tags of item + tags from mods
         * @returns {Array}
         */
        getTags: function () {
            return $.unique(this._super().concat(this.tags));
        },
        maxPrefixes: function () {
            switch (this.rarity) {
                case Item.rarity.NORMAL:
                    return 0;
                case Item.rarity.MAGIC:
                    return 1;
                case Item.rarity.RARE:
                case Item.rarity.SHOWCASE:
                    return 3;
                case Item.rarity.UNIQUE:
                    return Number.POSITIVE_INFINITY;
            }
        },
        maxSuffixes: function () {
            return this.maxPrefixes();
        },
        maxImplicits: function () {
            return 1;
        }
    });
    
    this.Item.rarity = {
        NORMAL: 1,
        MAGIC: 2,
        RARE: 3,
        UNIQUE: 4,
        SHOWCASE: 5
    };
})();

