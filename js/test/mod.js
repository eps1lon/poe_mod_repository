/* global ItemClassFactory, ModGeneratorFactory, BaseItem, ModGenerator, ModGeneratorException, e, Mod, ModInContext, Spawnable, Item, Applicable, ModFactory, Stat, ItemClass, RollableMod */

(function (__undefined) {
    // "tables"
    var mods = [],
        tags = [],
        baseitemtypes = [],
        stats = [];
    
    var TAGS = {};
    
    // template methods
    var create_from_template = function (selector, context) {
        if (context !== undefined) {
            selector = context.selector + " " + selector;
        }
        return $(selector + ".template").clone(true).removeClass("template");
    };
    
    var display_baseitem = function (baseitem, selector) {
        // assert baseitem typeof BaseItem
        // remove old itembox
        $(selector).empty();
        
        if (!(baseitem instanceof BaseItem)) {
            return false;
        }
        
        var $itembox = create_from_template(".itembox");
        var $statsgroup_template = create_from_template(".itembox-statsgroup", $itembox);
        var $statsgroup = $statsgroup_template.clone();
        var $separator_template = create_from_template(".separator", $itembox);
        
        // name
        $(".itemboxheader-single", $itembox).text(baseitem.name());
        
        // item_class
        $statsgroup.append(baseitem.item_class);
        
        // tags
        $statsgroup.append("<br>", $.map(baseitem.getTagsWithProps(tags), function (props) {
            return props.Id;
        }).join(", "));
        
        // sep
        $(".itembox-stats", $itembox).append($statsgroup);
        $(".itembox-stats", $itembox).append($separator_template.clone());
        $statsgroup = $statsgroup_template.clone();
        
        // Requirements TODO localize
        $statsgroup.append($.map(baseitem.requirements(), function (requirement, key) {
            return key + ": " + requirement;
        }).join(", "), "<br>");
        // ilvl
        $statsgroup.append("iLvl: ", baseitem.item_level);
        
        // sep
        $(".itembox-stats", $itembox).append($statsgroup);
        $(".itembox-stats", $itembox).append($separator_template.clone());
        $statsgroup = $statsgroup_template.clone();
        
        // implicits
        $.each(baseitem.implicits(), function (_, mod) {
            console.log("implicit", mod);
        });
        
        // affixes
        var $affixes = create_from_template("ul.mods", $itembox);
        $.each(baseitem.affixes(), function (i, mod) {
            var $mod = create_from_template("li.mod", $affixes);
            
            $mod.data("primary", mod.getProp("Rows"));
            
            $.each(mod.t().split("\n"), function (j, stat_text) {
                $("ul.stats", $mod).append("<li>" + stat_text + "</li>");
            });
            
            $mod.appendTo($affixes);
        });

        if ($(".stats li", $affixes).length > 0 || false) {
            $affixes.appendTo($statsgroup);
        }
        
        // sep
        $(".itembox-stats", $itembox).append($statsgroup);
        //$(".itembox-stats", $itembox).append($separator_template.clone())
        //$statsgroup = $statsgroup_template.clone();
        
        // append new one
        return $("#used_baseitem").append($itembox);
    };
    
    var display_available_mods = function (mod_generator, baseitem) {
        console.log(mod_generator, "@", baseitem, "?");
        
        // shown groups
        var $clicked_groups = $("#available_mods tr.clicked");
        
        // empty
        $("#available_mods tbody tr:not(.template)").remove();
            
        // extends ModGenerator implements Applicable
        if (!(mod_generator instanceof ModGenerator)) {
            console.log("mod_generator needs to be of type ModGenerator");
            return false;
        }

        if (!(baseitem instanceof BaseItem)) {
            console.log("baseitem needs to be of type BaseItem");
            return false;
        }
        
        baseitem.rarity = ItemClass.RARITY.SHOWCASE;
        
        // filter
        var whitelist = RollableMod.ROLLABLE_BYTE.LOWER_ILVL
                        | RollableMod.ROLLABLE_BYTE.DOMAIN_FULL
                        | RollableMod.ROLLABLE_BYTE.ALREADY_PRESENT;
        var applicable_mods = Applicable.mods(mod_generator.getAvailableMods(), 
                                              baseitem, 
                                              whitelist);
        
        // implements Spawnable?
        if (applicable_mods[0] !== __undefined && applicable_mods[0].spawnableOn) {
            // Spawnable.mods(applicable_mods, baseitem)
            // but we rather scan for reasons and display them
            Spawnable.map(applicable_mods, baseitem);
            
            applicable_mods = $.grep(applicable_mods, function (mod) {
                return mod.spawnweight > 0;
            });
        }
        
        // mod groups
        var prefixes = Spawnable.calculateSpawnchance($.grep(applicable_mods, function (mod) {
            return mod.isPrefix();
        }));
        
        var suffixes = Spawnable.calculateSpawnchance($.grep(applicable_mods, function (mod) {
            return mod.isSuffix();
        }));
        
        var implicits = Spawnable.calculateSpawnchance($.grep(applicable_mods, function (mod) {
            return mod.isImplicit();
        }));
        
        //console.log("implicits", implicits);
        //console.log("prefixes", prefixes);
        //console.log("suffix", suffixes);
        
        // display prefixes
        display_mod_group(prefixes, $("#prefixes"));
        
        // display suffixes
        display_mod_group(suffixes, $("#suffixes"));
        
        // display implicits 
        // empty mods
        $("#implicits tbody tr:not(.template)").remove();
        
        // display implicits
        $.each(implicits, function (_, mod) {
            var $tr = create_from_template("#implicits tbody tr.mod");
            
            // error TODO scan rollable_byte, spawnable_byte
            
            // ilvl
            $(".ilvl", $tr).text(mod.getProp("Level"));
            
            // name
            //$(".name", $tr).text(mod.getProp("CorrectGroup"));
            
            // value
            $(".stats", $tr).text(mod.t());
            
            // chance
            $(".spawn_chance", $tr).text(mod.humanSpawnchance());
            
            $tr.appendTo("#implicits");
        });
        
        // restore toggle groups
        $clicked_groups.each(function () {
            $("#" + $(this).attr("id")).trigger("click");
        });
        
        return true;
    };
    
    /**
     * 
     * @param {Array[Mod]} mods
     * @param {jQuery} table visual container
     * @returns {undefined}
     */
    var display_mod_group = function (mods, table) {
        var applicable_bits = RollableMod.APPLICABLE_BYTE;
        // empty mods
        $("tbody tr:not(.template)", table).remove();
        
        // display prefix
        $.each(mods, function (_, mod) {
            var $tr = create_from_template("tbody tr.mod", table).hide();
            
            // grouping
            var correct_group = mod.getProp("CorrectGroup");
            var $correct_group = $("tbody tr.correct_group[data-correct-group='" + correct_group + "']", table);
            
            // new group?
            if (!$correct_group.length) {
                // maybe change do data() and filter()
                $correct_group = create_from_template("tbody tr.correct_group", table);
                $correct_group.attr("id", "correct-group-" + correct_group);
                $correct_group.attr("data-correct-group", correct_group);
                
                $("td.correct_group", $correct_group).text(correct_group);
                
                $("tbody", table).append($correct_group);
            }
            
            // error TODO localize
            if (mod.applicable_byte ^ applicable_bits.SUCCESS) {
                var bits = [];
                var titles = [];

                $.each(applicable_bits, function (key, bit) {
                    if (mod.applicable_byte & bit) {
                        bits.push(bit);
                        titles.push(key);
                    }
                });
                
                $tr.prop("title", titles.join(" and "));
                $tr.attr("data-applicable_byte", bits.join("-"));
            }
            
            // TODO spawnable_byte
            
            // ilvl
            $(".ilvl", $tr).text(mod.getProp("Level"));
            
            // name
            $(".name", $tr).text(mod.getProp("Name"));
            
            // value
            $(".stats", $tr).text(mod.t());
            
            // chance
            $(".spawn_chance", $tr).text(mod.humanSpawnchance());
            
            $tr.data("mod", mod.serialize());
            
            $correct_group.after($tr);
        });
    };
        
    $.when(
        $.getJSON("js/data/mods.json", function (json) {
            mods = json;
        }),
        $.getJSON("js/data/tags.json", function (json) {
            tags = json;
            
            $(tags).each(function (_, tag) {
                TAGS[tag.Id.toUpperCase()] = +tag.Rows;
            });
        }),
        $.getJSON("js/data/baseitemtypes.json", function (json) {
            baseitemtypes = json;
        }),
        $.getJSON("js/data/stats.json", function (json) {
            stats = json;
            Mod.all_stats = stats;
        }),
        $.getJSON("js/data/translations/English/stat_descriptions.json", function (json) {
            Mod.localization = new Localization(json);
        })
    ).then(function () {
        console.log("loaded " + mods.length + " mods",
                    "loaded " + tags.length + " tags",
                    "loaded " + baseitemtypes.length + " baseitemtypes",
                    "loaded " + stats.length + " stats"); 
        
        var ring_tag = TAGS.RING;
        var amulet_tag = TAGS.AMULET;
        var transmute = new Transmute(mods);
        /*
        var item = new Item();
        item.addTag(ring_tag);
        item.addTag(amulet_tag);
        
        // test tags
        console.log("assert tags = [3, 2]", item.getTags());

        // test transmute
        console.log("assert true", transmute.applyTo(item));
        console.log("assert false", transmute.applyTo(item));
        
        // test addMod tags
        console.log("assert true", item.addTag(118));
        console.log("assert tags = [3,2,118]", item.getTags());
        
        console.log(item, transmute);
        
        // test applyTo
        var item2 = new Item();
        console.log("item2", item2);
        item2.addTag(ring_tag);
        console.log("transmute.applicableMods", transmute.applicableMods(item2));
        
        var no_attack_mods_mod = new Mod($.grep(mods, function (mod) {
            return mod["ModTypeKey"] == 1225;
        })[0]);
        console.log("no_attack_mods_mod", no_attack_mods_mod);
        
        //console.log("assert true", item2.addMod(no_attack_mods_mod));
        console.log("item2.tags", item2.getTags());
        console.log("transmute.applyTo(item2) assert true", transmute.applyTo(item2));
        console.log("item2", item2);
        
        
        // test itemfactory
        var bow = new ItemClass("BOW");
        console.log("bow", bow);
        console.log("transmute.applicableMods(bow)", $.unique($.map($.grep(transmute.applicableMods(bow), function (mod) {
            return mod.mod.suffix();
        }), function (mod) {
            //return mod.mod;
            return mod.mod.getProp("CorrectGroup");
        })));*/
        
        // persistence vars
        var mod_generator = null;
        var baseitem = null;
        
        var get_selected_mod_generator = function () {
            return ModGeneratorFactory.build($("#mod_generators option:selected").data("ident"), mods);
        };
        
        var get_selected_baseitem = function () {
            var baseitem_key = $("#baseitems option:selected").data("baseitem_key");

            var baseitem_props = $.grep(baseitemtypes, function (baseitem_props) {
                return baseitem_key === +baseitem_props.Rows;
            })[0];
            
            if (baseitem_props === __undefined) {
                return null;
            }
            
            return new BaseItem(baseitem_props);
        };
        
        // display item_classes
        $.each(ItemClassFactory.ITEMCLASSES, function (ident, item_class) {
            var $option = create_from_template("#item_classes option");
            
            $option.text(ident);
            $option.data("ident", ident);
            
            $option.appendTo("#item_classes");
        });
        
        // change item_class handle
        $("#item_classes").on("change", function () {
            var $selected = $("option:selected", this);
            
            // selected ItemClass
            var item_class = ItemClassFactory.build($selected.data("ident"));
            if (item_class === null) {
                return false;
            }

            // baseitems that have this ItemClass
            var baseitems = $.grep(baseitemtypes, function (baseitemtype) {
                //console.log(baseitemtype.ItemClass);
                return item_class.itemClassPrimary() === +baseitemtype.ItemClass;
            });
            
            // empty baseitems
            $("#baseitems option:not(.template)").remove();
            
            // display baseitems
            $.each(baseitems, function (_, baseitem_props) {
                var $option = create_from_template("#baseitems option");
                $option.text(baseitem_props.Name);
                $option.data("baseitem_key", +baseitem_props.Rows);
                $option.appendTo("#baseitems");
            });
            
            // select empty on 
            $("#baseitems option.template").prop("selected", true);
            
            // and trigger onchange
            $("#baseitems").trigger("change");
        }); 
        
        // change item_class handle
        $("#baseitems").on("change", function () {
            // persistence
            baseitem = get_selected_baseitem();
            
            // update gui
            display_baseitem(baseitem, "#used_baseitem");
            display_available_mods(mod_generator, baseitem);          
        }); 
        
        // display generators
        $.each(ModGeneratorFactory.GENERATORS, function (ident, generator) {
            var $option = create_from_template("#mod_generators option");
            
            $option.text(generator.name);
            $option.data("ident", ident);
            
            $option.appendTo("#mod_generators");
        });
        
        // change modgen handle
        $("#mod_generators").on("change", function () {
            // persistence
            mod_generator = get_selected_mod_generator();
            
            // update gui
            display_available_mods(mod_generator, baseitem);
        });
        
        // mod gen handle
        $("#use_mod_gen").on("click", function () {
            console.log(mod_generator, "@", baseitem);
            
            if (!(mod_generator instanceof ModGenerator)) {
                console.log("mod_generator needs to be of type ModGenerator");
                return false;
            }
            
            if (!(baseitem instanceof BaseItem)) {
                console.log("baseitem needs to be of type BaseItem");
                return false;
            }
            
            // apply
            mod_generator.applyTo(baseitem);
            /*
            try {
                mod_generator.applyTo(baseitem);
            } catch (e) {
                if (e instanceof ModGeneratorException) {
                    console.log("ModGeneratorException", e.message);
                } else {
                    console.trace(e);
                }
                
                return false;
            }//*/
            
            
            // display
            display_baseitem(baseitem);
            
            return true;
        });
        
        // display mod group
        $("#available_mods tr.correct_group").on("click", function () {
            $(this).toggleClass("clicked").nextUntil(".correct_group").toggle();
        });
        
        // display implcits
        $("#implicits-caption").on("click", function () {
            console.log("clicked");
            $(this).toggleClass("clicked").parents("table").children("tbody").toggle();
        });
        
        // add mod
        $(".add_mod").on("click", function () {
            // assert baseitem instanceof baseitem
            var serialized = $(this).parents("tr").data("mod");
            var mod = ModFactory.deserialize(serialized);
            
            if (mod === null) {
                console.log("could not deserialize", serialized);
            }
            console.log(baseitem, "+", mod);
            
            if (baseitem.addMod(mod)) {
                display_baseitem(baseitem, "#used_baseitem");
                
                display_available_mods(mod_generator, baseitem);
            } else {
                // TODO flash error
            }
        });
        
        // remove mod
        $(".remove_mod").on("click", function () {
            var $mod = $(this).parents(".mod");
            
            baseitem.removeMod(baseitem.getMod($mod.data("primary")));
            
            display_baseitem(baseitem, "#used_baseitem");
            display_available_mods(mod_generator, baseitem);
        });
        
        // test dom handles
        $("#item_classes option:not(.template)").filter(function () {
            return $(this).text().toLowerCase() === "dagger";
        }).prop("selected", true);
        $("#item_classes").trigger("change");
        
        $("#baseitems option:not(.template)").filter(":first").prop("selected", true);
        $("#baseitems").trigger("change");
        
        $("#mod_generators option:not(.template)").filter(":first").prop("selected", true);
        $("#mod_generators").trigger("change");
        
        //$("#use_mod_gen").trigger("click");
    });
})();

