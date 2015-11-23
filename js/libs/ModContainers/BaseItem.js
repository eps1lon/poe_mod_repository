/* global ItemClass, ItemClassFactory, Item */

(function (__undefined) {
    /**
     * deprecated
     */
    this.BaseItem = ItemClass.extend({
        init: function (props) {
            // init ItemClass 
            var item_class_ident = ItemClassFactory.ident(+props.ItemClass);
            this._super(item_class_ident, 
                        ItemClassFactory.ITEMCLASSES[item_class_ident].TAGS, 
                        ItemClassFactory.ITEMCLASSES[item_class_ident].DOMAIN);
            
            // extended
            this.item_level = BaseItem.MAX_ILVL;
            this.entry = new GgpkEntry(props);
            
            this.random_name = "";
        }
    });
})();

