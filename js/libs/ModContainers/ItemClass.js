/* global Class, ItemClassFactory, Item, this */

(function (__undefined) {
    this.ItemClass = Item.extend({
        init: function (item_class_ident, tags, domain) {
            this._super();
            
            this.tags = this.tags.concat(tags);
            this.item_class = item_class_ident;
            this.domain = domain;
        },
        itemClassPrimary: function () {
            return ItemClassFactory.primary(this.item_class);
        }
    });
    
    this.ItemClassFactory = Class.extend({});
    
    this.ItemClassFactory.build = function (ident) {
        if (ItemClassFactory.ITEMCLASSES[ident] === __undefined) {
            return null;
        }
        return new ItemClass(ident, ItemClassFactory.ITEMCLASSES[ident].TAGS, ItemClassFactory.ITEMCLASSES[ident].DOMAIN);
    };
    
    this.ItemClassFactory.primary = function (ident) {
        return ItemClassFactory.ITEMCLASSES[ident].PRIMARY;
    };
    
    this.ItemClassFactory.ident = function (primary) {
        return "BOW";
    };
    
    this.ItemClassFactory.ITEMCLASSES = {
        BOW: {
            PRIMARY: 14,
            // Weapon, Two-Handed Weapon, bow, ranged
            TAGS: [8, 82, 5, 32],
            DOMAIN: 1
        }
    };
})();

