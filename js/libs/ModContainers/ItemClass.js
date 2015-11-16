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
        AMULET: {
            PRIMARY: 5, 
            // amulet, default
            TAGS: [3, 0], 
            DOMAIN: 1
        },
        RING: {
            PRIMARY: 6, 
            // ring, default
            TAGS: [2, 0], 
            DOMAIN: 1
        },
        CLAW: {
            PRIMARY: 7, 
            // claw, onehandweapon, weapon
            TAGS: [14, 81, 8], 
            DOMAIN: 1
        },
        DAGGER: { 
            PRIMARY: 8, 
            // dagger, onehandweapon, weapon
            TAGS: [13, 81, 8], 
            DOMAIN: 1
        },
        WAND: { 
            PRIMARY: 9, 
            // wand, onehandweapon, weapon, ranged
            TAGS: [9, 81, 8, 32],  
            DOMAIN: 1
        },
        SWORD_1H: { 
            PRIMARY: 10, 
            // sword, onehandweapon, weapon
            TAGS: [12, 81, 8], 
            DOMAIN: 1
        },
        THRUSTING_SWORD_1H: {
            PRIMARY: 11, 
            // sword, onehandweapon, weapon
            TAGS: [12, 81, 8], 
            DOMAIN: 1
        },
        AXE_1H: {
            PRIMARY: 12, 
            // axe, onehandweapon, weapon
            TAGS: [15, 81, 8],
            DOMAIN: 1
        },
        MACE_1H: { 
            PRIMARY: 13, 
            // mace, onehandweapon, weapon
            TAGS: [11, 81, 8],
            DOMAIN: 1
        },
        BOW: {
            PRIMARY: 14,
            // bow, twohandweapon, weapon, ranged
            TAGS: [5, 82, 8, 32],
            DOMAIN: 1
        },
        STAFF: { 
            PRIMARY: 15, 
            // Staff, twohandweapon, weapon
            TAGS: [10, 82, 8],
            DOMAIN: 1
        },
        SWORD_2H: { 
            PRIMARY: 16, 
            // sword, twohandweapon, weapon
            TAGS: [12, 82, 8],
            DOMAIN: 1
        },
        AXE_2H: { 
            PRIMARY: 17, 
            // axe, twohandweapon, weapon
            TAGS: [15, 82, 8], 
            DOMAIN: 1
        },
        MACE_2H: {
            PRIMARY: 18, 
            // mace, twohandweapon, weapon
            TAGS: [11, 82, 8],
            DOMAIN: 1
        },
        QUIVER: {
            PRIMARY: 21, 
            // quiver, default
            TAGS: [21, 0], 
            DOMAIN: 1
        },
        BELT: {
            PRIMARY: 22, 
            // belt, default
            TAGS: [26, 0], 
            DOMAIN: 1
        },
        GLOVES: {
            PRIMARY: 23, 
            // gloves, armour, default
            TAGS: [22, 7, 0], 
            DOMAIN: 1
        },
        BOOTS: {
            PRIMARY: 24, 
            // boots, armour, default
            TAGS: [4, 7, 0], 
            DOMAIN: 1
        },
        ARMOUR: {
            PRIMARY: 25, 
            // body_armour, armour, default
            TAGS: [16, 7, 0], 
            DOMAIN: 1
        },
        HELMET: {
            PRIMARY: 26, 
            // helmet, armour, default
            TAGS: [25, 7, 0], 
            DOMAIN: 1
        },
        SHIELD: { 
            PRIMARY: 27, 
            // shield, armour, default
            TAGS: [1, 7, 0], 
            DOMAIN: 1
        },
        SCEPTRE: {
            PRIMARY: 33, 
            // sceptre, onehandweapon, weapon
            TAGS: [37, 81, 8],
            DOMAIN: 1
        },
        MAP: {
            PRIMARY: 36, 
            // default
            TAGS: [0], 
            DOMAIN: 5
        },
        FISHING_ROD: {
            PRIMARY: 38, 
            // fishing_rod
            TAGS: [80], 
            DOMAIN: 1
        },
        MAP_FRAGMENT: { 
            PRIMARY: 39,
            TAGS: [], 
            DOMAIN: 1
        },
        JEWEL: {
            PRIMARY: 42, 
            // default
            TAGS: [0], 
            DOMAIN: 11
        }
    };
})();

