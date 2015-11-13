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
        return $.map(ItemClassFactory.ITEMCLASSES, function (itemclass, ident) {
            if (+itemclass.PRIMARY === +primary) {
                return ident;
            }
            return null;
        })[0];
    };
    
    this.ItemClassFactory.ITEMCLASSES = {
        AMULET: { // TODO
            PRIMARY: 5, 
            TAGS: [3], 
            DOMAIN: 1
        },
        RING: { // TODO
            PRIMARY: 6, 
            TAGS: [], 
            DOMAIN: 1
        },
        CLAW: { // TODO
            PRIMARY: 7, 
            TAGS: [], 
            DOMAIN: 1
        },
        DAGGER: { // TODO
            PRIMARY: 8, 
            TAGS: [], 
            DOMAIN: 1
        },
        WAND: { // TODO
            PRIMARY: 9, 
            TAGS: [], 
            DOMAIN: 1
        },
        SWORD_1H: { // TODO
            PRIMARY: 10, 
            TAGS: [], 
            DOMAIN: 1
        },
        THRUSTING_SWORD_1H: { // TODO
            PRIMARY: 11, 
            TAGS: [], 
            DOMAIN: 1
        },
        AXE_1H: { // TODO
            PRIMARY: 12, 
            TAGS: [], 
            DOMAIN: 1
        },
        MACE_1H: { // TODO
            PRIMARY: 13, 
            TAGS: [], 
            DOMAIN: 1
        },
        BOW: {
            PRIMARY: 14,
            // Weapon, Two-Handed Weapon, bow, ranged
            TAGS: [8, 82, 5, 32],
            DOMAIN: 1
        },
        STAFF_2H: { // TODO
            PRIMARY: 15, 
            TAGS: [], 
            DOMAIN: 1
        },
        SWORD_2H: { // TODO
            PRIMARY: 16, 
            TAGS: [], 
            DOMAIN: 1
        },
        AXE_2H: { // TODO
            PRIMARY: 17, 
            TAGS: [], 
            DOMAIN: 1
        },
        MACE_2H: { // TODO
            PRIMARY: 18, 
            TAGS: [], 
            DOMAIN: 1
        },
        QUIVER: { // TODO
            PRIMARY: 21, 
            TAGS: [], 
            DOMAIN: 1
        },
        BELT: { // TODO
            PRIMARY: 22, 
            TAGS: [], 
            DOMAIN: 1
        },
        GLOVES: { // TODO
            PRIMARY: 23, 
            TAGS: [], 
            DOMAIN: 1
        },
        BOOTS: { // TODO
            PRIMARY: 24, 
            TAGS: [], 
            DOMAIN: 1
        },
        ARMOUR: { // TODO
            PRIMARY: 25, 
            TAGS: [], 
            DOMAIN: 1
        },
        HELMET: { // TODO
            PRIMARY: 26, 
            TAGS: [], 
            DOMAIN: 1
        },
        SHIELD: { // TODO
            PRIMARY: 27, 
            TAGS: [], 
            DOMAIN: 1
        },
        SCEPTRE: { // TODO
            PRIMARY: 33, 
            TAGS: [], 
            DOMAIN: 1
        },
        MAP: { // TODO
            PRIMARY: 36, 
            TAGS: [], 
            DOMAIN: 1
        },
        FISHING_ROD: { // TODO
            PRIMARY: 38, 
            TAGS: [], 
            DOMAIN: 1
        },
        MAP_FRAGMENT: { // TODO
            PRIMARY: 39, 
            TAGS: [], 
            DOMAIN: 1
        },
        JEWEL: { // TODO
            PRIMARY: 42, 
            TAGS: [], 
            DOMAIN: 1
        }
    };
})();

