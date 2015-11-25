/* global ItemClassFactory, ModGeneratorFactory, BaseItem, ModGenerator, ModGeneratorException, e, Mod, ModInContext, Spawnable, Item, Applicable, ModFactory, Stat, ItemClass, RollableMod, ApplicableMod, MasterMod, baseitem */

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
    
        // assert baseitem typeof BaseItem
    var display_baseitem = function (baseitem, selector) {
        // assert baseitem typeof BaseItem
        // remove old itembox
        $(selector).empty();
        
        if (!(baseitem instanceof Item)) {
            return false;
        }
        
        var $itembox = create_from_template(".itembox");
        
        $itembox.addClass(baseitem.rarityIdent());
        
        var $statsgroup_template = create_from_template(".itembox-statsgroup", $itembox);
        var $statsgroup = $statsgroup_template.clone();
        
        // name
        $(".itemboxheader .itemName", $itembox).text(baseitem.itemName());
        $(".itemboxheader .baseName", $itembox).text(baseitem.baseName());
        
        // item_class
        $statsgroup.append(baseitem.itemclassIdent().toLowerCase().ucfirst());
        
        // tags
        $statsgroup.append("<br>", $.map(baseitem.getTagsWithProps(tags), function (props) {
            return props.Id.underscoreToHuman();
        }).join(", "));
        
        // stats
        $.each(baseitem.localStats(), function (stat_desc, value) {
            $statsgroup.append("<br>", stat_desc, ": ", "<span class='text-value'>" + value + "</span>");
        });
        
        // sep
        $(".itembox-stats", $itembox).append($statsgroup);
        $statsgroup = $statsgroup_template.clone();
        
        // Requirements
        $statsgroup.append("Requires ", $.map(baseitem.requirements(), function (requirement, key) {
            return key + " <span class='text-value'>" + requirement + "</span>";
        }).join(", "), "<br>");
        // ilvl
        $statsgroup.append(create_from_template(".ilvl", $itembox).val(baseitem.item_level));
        
        // sep
        $(".itembox-stats", $itembox).append($statsgroup);
        $statsgroup = $statsgroup_template.clone();
        
        $.each(["implicits", "affixes"], function (_, modGetter) {
            // sep
            $(".itembox-stats", $itembox).append($statsgroup);
            $statsgroup = $statsgroup_template.clone();

            var $mods = create_from_template("ul.mods", $itembox);
            $mods.addClass(modGetter);

            // affixes
            $.each(baseitem[modGetter](), function (i, mod) {
                var $mod = create_from_template("li.mod", $mods);

                $mod.data("primary", mod.getProp("Rows"));
                $mod.addClass("mod-type-" + mod.modType());
                $mod.addClass(mod.serialize().klass);
                
                $(".name", $mod).text(mod.name());
                
                $.each(mod.t().split("\n"), function (j, stat_text) {
                    $("ul.stats", $mod).append("<li>" + stat_text + "</li>");
                });

                $mod.appendTo($mods);
            });

            if ($(".stats li", $mods).length > 0 || false) {
                $mods.appendTo($statsgroup);
            }
        });

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
        var $clicked_groups = $("#available_mods tbody.clicked");
                
        // extends ModGenerator implements Applicable
        if (!(mod_generator instanceof ModGenerator)) {
            console.log("mod_generator needs to be of type ModGenerator");
            return false;
        }

        if (!(baseitem instanceof Item)) {
            console.log("baseitem needs to be of type BaseItem");
            return false;
        }
        
        baseitem.rarity = Item.RARITY.SHOWCASE;
        
        // filter
        var whitelist = ApplicableMod.APPLICABLE_BYTE.LOWER_ILVL
                        | ApplicableMod.APPLICABLE_BYTE.DOMAIN_FULL
                        | ApplicableMod.APPLICABLE_BYTE.ALREADY_PRESENT;
        var applicable_mods = Applicable.mods(mod_generator.getAvailableMods(), 
                                              baseitem, 
                                              whitelist);
        
        // implements Spawnable?
        var whitelist_spawnable = 0;

        applicable_mods = Spawnable.mods(applicable_mods, 
                                         baseitem, 
                                         whitelist_spawnable);
        
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
            
            // error
            var applicable_byte_human = mod.applicableByteHuman();
            $tr.attr("data-applicable_byte", applicable_byte_human.bits.join("-"));
            
            var spawnable_byte_human = {
                strings: []
            };
            
            if (Spawnable.implementedBy(mod)) {
                spawnable_byte_human = mod.spawnableByteHuman();
                $tr.attr("data-spawnable-byte", spawnable_byte_human.bits.join("-"));
                
                // chance
                $(".spawn_chance", $tr).text(mod.humanSpawnchance());
            }
            
            $tr.prop("title", applicable_byte_human.strings.concat(spawnable_byte_human.strings).join(" and "));
            
            // ilvl
            $(".ilvl", $tr).text(mod.getProp("Level"));
            
            // name
            //$(".name", $tr).text(mod.getProp("CorrectGroup"));
            
            // value
            $(".stats", $tr).text(mod.t());
            
            // chance
            $(".spawn_chance", $tr).text(mod.humanSpawnchance());
            
            // serialized
            var serialized = mod.serialize();
            $tr.data("mod", serialized);
            
            // visual
            $tr.addClass(serialized.klass);
            $tr.addClass(mod.modType());
            
            // possible? TODO better way? maybe scan byte
            if ($tr.prop("title")) {
                $(".add_mod", $tr).remove();
            }
            
            $tr.appendTo("#implicits");
        });
        
        // let the plugin know that we made a update 
        $("#implicits").trigger("update"); 
        // sort on ilvl desc
        $("#implicits").trigger("sorton",[[[0,1]]]);
        
        // remove not_rollable class if rollable
        $.each(prefixes.concat(suffixes), function (i, mod) {
            if (mod.rollableCached()) {
                $("#correct-group-" + mod.getProp("CorrectGroup")).removeClass("not_rollable");
            }
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
     * @param {jQuery} $table visual container
     * @returns {undefined}
     */
    var display_mod_group = function (mods, $table) {
        // empty mods
        $("tbody:not(.template)", $table).remove();
        
        // display prefix
        $.each(mods, function (_, mod) {
            var $mod = create_from_template("tbody.mods.template .mod", $table);
            
            // grouping
            var correct_group = mod.getProp("CorrectGroup");
            var $correct_group = $("tbody.mods[data-correct-group='" + correct_group + "']", $table);
            
            // new group?
            if (!$correct_group.length) {
                var $correct_group_header = create_from_template("tbody.correct_group", $table);
                $correct_group = create_from_template("tbody.mods", $table).hide();
                
                // maybe change do data() and filter()
                $correct_group_header.attr("id", "correct-group-" + correct_group);
                $correct_group.attr("data-correct-group", correct_group);
                
                $("th.correct_group", $correct_group_header).text(mod.correctGroupTranslated());
                
                $table.append($correct_group_header, $correct_group);
            }
            
            // error
            var applicable_byte_human = mod.applicableByteHuman();
            $mod.attr("data-applicable_byte", applicable_byte_human.bits.join("-"));
            
            var spawnable_byte_human = {
                strings: []
            };
            if (Spawnable.implementedBy(mod)) {
                spawnable_byte_human = mod.spawnableByteHuman();
                $mod.attr("data-spawnable-byte", spawnable_byte_human.bits.join("-"));
                
                // chance
                $(".spawn_chance", $mod).text(mod.humanSpawnchance());
            }
            
            $mod.prop("title", applicable_byte_human.strings.concat(spawnable_byte_human.strings).join(" and "));
            
            // ilvl
            $(".ilvl", $mod).text(mod.getProp("Level"));
            
            // name
            $(".name", $mod).text(mod.name());
            
            // value
            $(".stats", $mod).text(mod.t());
            
            // serialize
            var serialized = mod.serialize();
            $mod.data("mod", serialized);
            
            // possible? TODO better way? maybe scan byte
            if ($mod.prop("title")) {
                $(".add_mod", $mod).remove();
            }
            
            // visual
            $mod.addClass(serialized.klass);
            $mod.addClass(mod.modType());
            
            $correct_group.append($mod);
        });
        
        // let the plugin know that we made a update 
        $table.trigger("update"); 
        // sort on ilvl desc
        $table.trigger("sorton",[[[0,1]]]);
    };
        
    // load data
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
        }),
        $.getJSON("js/data/meta_data.json", function (json) {
            Item.meta_data = json;
        }),
        $.getJSON("js/data/craftingbenchoptions.json", function (json) {
            MasterMod.craftingbenchoptions = json;
        }),
        $.getJSON("js/data/translations/English/mod_correct_groups.json", function (json) {
            Mod.correct_group_localization = json;
        })
    ).then(function () {
        console.log("loaded " + mods.length + " mods",
                    "loaded " + tags.length + " tags",
                    "loaded " + baseitemtypes.length + " baseitemtypes",
                    "loaded " + stats.length + " stats"); 

        // persistence vars
        var mod_generator = null;
        var baseitem = null;
        
        var get_selected_mod_generator = function () {
            return ModGeneratorFactory.build($("#mod_generators option:selected").data("ident"), mods);
        };
        
        var get_selected_baseitem = function () {
            var baseitem_key = $("#baseitems option:selected").data("baseitem_primary");
            
            if (baseitem_key === __undefined) {
                return null;
            }
            
            var baseitem_props = baseitemtypes[baseitem_key];
            
            if (baseitem_props === __undefined) {
                console.log("could not find", baseitem_key);
                return null;
            }
            
            var baseitem = new Item(baseitem_props);
            var $ilvl = $("#used_baseitem input.ilvl:not(.template)");
            if ($ilvl.length) {
                baseitem.item_level = +$ilvl.val();
            } 
            return baseitem;
        };
        
        // display item_classes
        $.each(Item.ITEMCLASSES, function (ident, item_class) {
            var $option = create_from_template("#item_classes option");
            
            $option.text(ident);
            $option.data("ident", ident);
            
            $option.appendTo("#item_classes");
        });
        
        // change item_class handle
        $("#item_classes").on("change", function () {
            var $selected = $("option:selected", this);
            
            // selected ItemClass
            var item_class = Item.ITEMCLASSES[$selected.data("ident")];
            if (item_class === null) {
                return false;
            }

            // baseitems that have this ItemClass
            // needs map instead of grep because table structure primary => table cols
            var baseitems = $.map(baseitemtypes, function (baseitemtype) {
                if (item_class.PRIMARY === +baseitemtype.ItemClass) {
                    return baseitemtype;
                }
                return null;
            });
            
            // empty baseitems
            $("#baseitems option:not(.template)").remove();
            
            // display baseitems
            $.each(baseitems, function (_, baseitem_props) {
                var $option = create_from_template("#baseitems option");
                $option.text(baseitem_props.Name);
                $option.data("baseitem_primary", baseitem_props.primary);
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
        $("#available_mods tbody.correct_group").on("click", function () {
            $(this).toggleClass("clicked").next().toggle();
        });
        
        // display implcits
        $("#implicits-caption").on("click", function () {
            $(this).toggleClass("clicked").parents("table").children("tbody").toggle();
        });
        
        // jQuery Tablesorter config
        $("#prefixes, #suffixes, #implicits").tablesorter({
            cssInfoBlock : "tablesorter-no-sort"
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
        
        // ilvl handle
        $("input.ilvl").on("change", function () {
            baseitem.item_level = +$(this).val();
            
            display_available_mods(mod_generator, baseitem);
        });
        
        // test dom handles
        $("#item_classes option:not(.template)").filter(function () {
            return $(this).text().toLowerCase() === "armour";
        }).prop("selected", true);
        $("#item_classes").trigger("change");
        
        $("#baseitems option:not(.template)").filter(":first").prop("selected", true);
        $("#baseitems").trigger("change");
        
        $("#mod_generators option:not(.template)").filter(":nth-of-type(3)").prop("selected", true);
        $("#mod_generators").trigger("change");

        $("#prefixes tbody:not(.template) .add_mod:first").trigger("click");
        
        //$("#use_mod_gen").trigger("click");
    });
})();

