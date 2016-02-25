(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* jshint bitwise:false */
/*!
 * PoE Mod Repository
 * By Sebastian Silbermann
 * MIT Licensed.
 */
(function (__undefined) {
    if (window === __undefined) {
        console.error("need window context");
        return;
    }
    
    //node
    var ModGeneratorFactory = require('./libs/ModGenerators/ModGeneratorFactory');
    var ModGenerator        = require('./libs/ModGenerators/ModGenerator');
    var Masterbench         = require('./libs/ModGenerators/Masterbench');
    var Item                = require('./libs/ModContainers/Item');
    var Mod                 = require('./libs/mods/Mod');
    var ModFactory          = require('./libs/mods/ModFactory');
    var ApplicableMod       = require('./libs/mods/ApplicableMod');
    var MasterMod           = require('./libs/mods/MasterMod');
    var Spawnable           = require('./libs/Spawnable');
    var DataDependency      = require('./libs/DataDependency');
    var Localization        = require('./libs/Localization');
    var Hashbang            = require('./libs/Hashbang');
    var ByteSet             = require('./libs/concerns/ByteSet');
    
    require('./libs/concerns/Array');
    require('./libs/concerns/ByteSet');
    require('./libs/concerns/Math');
    require('./libs/concerns/Number');
    require('./libs/concerns/Object');
    require('./libs/concerns/String');
    
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
        
        // rarity
        var rarity_ident = baseitem.rarityIdent();
        $itembox.addClass(rarity_ident);
        $("#item_rarities option[value='" + rarity_ident.toUpperCase() + "']").prop("selected", true);
        
        var $statsgroup_template = create_from_template(".itembox-statsgroup", $itembox);
        var $statsgroup = $statsgroup_template.clone(true);
        
        // name
        $(".itemboxheader .itemName", $itembox).text(baseitem.itemName());
        $(".itemboxheader .baseName", $itembox).text(baseitem.baseName());
        
        // item_class
        $statsgroup.addClass("meta_data");
        $statsgroup.append(baseitem.itemclassIdent().toLowerCase().ucfirst());
        
        // tags
        $statsgroup.append("<br>", $.map(baseitem.getTagsWithProps(tags), function (props) {
            return props.Id.underscoreToHuman();
        }).join(", "));
        
        // sep
        $(".itembox-stats", $itembox).append($statsgroup);
        $statsgroup = $statsgroup_template.clone(true);
        $statsgroup.addClass("localStats");
        
        // stats
        $.each(baseitem.localStats(), function (stat_desc, value) {
            $statsgroup.append("<br>", stat_desc, ": ", "<span class='text-value'>" + value + "</span>");
        });
        
        // sep
        if ($.trim($statsgroup.text()).length) {
            $(".itembox-stats", $itembox).append($statsgroup);
        }
        $statsgroup = $statsgroup_template.clone(true);
        $statsgroup.addClass("requirements");
        
        // Requirements
        $statsgroup.append("Requires ", $.map(baseitem.requirements(), function (requirement, key) {
            return key + " <span class='text-value'>" + requirement + "</span>";
        }).join(", "), "<br>");
        // ilvl
        $statsgroup.append(create_from_template(".ilvl", $itembox).val(baseitem.item_level));
        
        $.each(["implicits", "affixes"], function (_, modGetter) {
            // sep
            if ($.trim($statsgroup.text()).length) {
                $(".itembox-stats", $itembox).append($statsgroup);
            }
            
            $statsgroup = $statsgroup_template.clone();
            $statsgroup.addClass(modGetter);

            var $mods = create_from_template("ul.mods", $itembox);
            $mods.addClass(modGetter);

            // affixes
            $.each(baseitem["get" + modGetter.ucfirst()](), function (i, mod) {
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
        if ($.trim($statsgroup.text()).length) {
            $(".itembox-stats", $itembox).append($statsgroup);
        }
        //$(".itembox-stats", $itembox).append($separator_template.clone())
        //$statsgroup = $statsgroup_template.clone();
        
        // append new one
        return $("#used_baseitem").append($itembox);
    };
    
    var display_available_mods = function (mod_generator, baseitem) {
        console.log(mod_generator, "@", baseitem, "?");
        
        // shown groups
        var $clicked_groups = $("#available_mods tbody.clicked");
        var was_expanded = $("table.mods").hasClass("expanded");
                
        // extends ModGenerator implements Applicable
        if (!(mod_generator instanceof ModGenerator)) {
            console.log("mod_generator needs to be of type ModGenerator");
            return false;
        }

        if (!(baseitem instanceof Item)) {
            console.log("baseitem needs to be of type BaseItem");
            return false;
        }
        
        // filter
        var whitelist = ApplicableMod.APPLICABLE_BYTE.LOWER_ILVL
                        | ApplicableMod.APPLICABLE_BYTE.DOMAIN_FULL
                        | ApplicableMod.APPLICABLE_BYTE.ALREADY_PRESENT
                        | MasterMod.APPLICABLE_BYTE.NO_MULTIMOD
                        | ApplicableMod.APPLICABLE_BYTE.ABOVE_LLD_LEVEL;
        
        var applicable_mods = mod_generator.mods(baseitem, whitelist);
        
        // mod groups
        var prefixes = Spawnable.calculateSpawnchance($.grep(applicable_mods, function (mod) {
            return mod.isPrefix();
        }), function (mod) {
            return mod.applicableCached();
        });
        
        var suffixes = Spawnable.calculateSpawnchance($.grep(applicable_mods, function (mod) {
            return mod.isSuffix();
        }), function (mod) {
            return mod.applicableCached();
        });
        
        var implicits = Spawnable.calculateSpawnchance($.grep(applicable_mods, function (mod) {
            return mod.implicitCandidate();
        }), function (mod) {
            return mod.applicableCached();
        });
        
        //console.log("implicits", implicits);
        //console.log("prefixes", prefixes);
        //console.log("suffix", suffixes);
        
        // display prefixes
        display_mod_group(prefixes, $("#prefixes"), true);
        
        // display suffixes
        display_mod_group(suffixes, $("#suffixes"), true);
        
        // display implicits 
        display_mod_group(implicits, $("#implicits"), false);
        
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
        
        // was expanded?
        if (was_expanded) {
            $("#expand_mods").trigger("click");
        }
        
        return true;
    };
    
    /**
     * 
     * @param {Array[Mod]} mods
     * @param {jQuery} $table visual container
     * @param {Boolean} grouping wether to group mods of a group into tbodies
     * @returns {void}
     */
    var display_mod_group = function (mods, $table, grouping) {
        // empty mods
        if (grouping) {
            $("tbody:not(.template)", $table).remove();
        } else {
            $(".mod:not(.template)", $table).remove();
        }
        var $mod_template = create_from_template(".mod", $table);

        // display affixes
        $("caption .count", $table).text(mods.length);
        $.each(mods, function (_, mod) {
            var $mod = $mod_template.clone(true);
            var serialized = mod.serialize();
            var title, correct_group, $correct_group;
            
            $mod.attr("id", mod.domId());
            
            // grouping
            if (grouping) {
                correct_group = mod.getProp("CorrectGroup");
                $correct_group = $("tbody.mods[data-correct-group='" + correct_group + "']", $table);
                
                // new group?
                if (!$correct_group.length) {
                    var $correct_group_header = create_from_template("tbody.correct_group", $table);
                    $correct_group = create_from_template("tbody.mods", $table).hide();

                    // maybe change do data() and filter()
                    $correct_group_header.attr("id", "correct-group-" + correct_group);
                    $correct_group.attr("data-correct-group", correct_group);

                    $("th.correct_group", $correct_group_header).text(mod.correctGroupTranslated().replace(/\n/, " / "));

                    $table.append($correct_group_header, $correct_group);
                }
            } else {
                $correct_group = $("tbody", $table);
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
            
            title = applicable_byte_human.strings.concat(spawnable_byte_human.strings).join("` and `");
            if (title) {
                $mod.prop("title", "`" + title + "`");
            }
            
            // ilvl
            $(".ilvl", $mod).text(mod.getProp("Level"));
            
            // name
            $(".name", $mod).text(mod.name());
            
            // value
            $(".stats", $mod).text(mod.t());
            
            // serialize
            $mod.data("mod", serialized);
            
            // possible? TODO better way? maybe scan byte
            if (title) {
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
    
    var display_mod_gen_applicability = function (baseitem, all_mods) {
        if (!(baseitem instanceof Item)) {
            return false;
        }
        
        $("ul.currencies .applicable input.ModGenerator:radio").each(function () {
            var $this = $(this);
            var $applicable = $this.parents(".applicable");
            var mod_generator = ModGeneratorFactory.build($this.val(), all_mods);
            
            $this.prop("disabled", !mod_generator.applicableTo(baseitem));
            var applicable_byte = mod_generator.applicableByteHuman();

            $applicable.attr("title", applicable_byte.strings.join(" and "));
            $applicable.attr("data-applicable_byte", applicable_byte.bits.join("-"));
        });
    };
        
    // load data
    $.when(
        new DataDependency("js/data/mods.json", "#data_loader_mods").getJSON(function (json) {
            mods = json;
            Mod.mods = mods;
        }),
        new DataDependency("js/data/tags.json", "#data_loader_tags").getJSON(function (json) {
            tags = json;
            
            $(tags).each(function (_, tag) {
                TAGS[tag.Id.toUpperCase()] = +tag.Rows;
            });
        }),
        new DataDependency("js/data/baseitemtypes.json", "#data_loader_baseitemtypes").getJSON(function (json) {
            baseitemtypes = json;
        }),
        new DataDependency("js/data/stats.json", "#data_loader_stats").getJSON(function (json) {
            stats = json;
            Mod.all_stats = stats;
        }),
        new DataDependency("js/data/translations/English/stat_descriptions.json", "#data_loader_stat_desc").getJSON(function (json) {
            Mod.localization = new Localization(json);
        }),
        new DataDependency("js/data/meta_data.json", "#data_loader_meta_data").getJSON(function (json) {
            Item.meta_data = json;
        }),
        new DataDependency("js/data/craftingbenchoptions.json", "#data_loader_craftingbenchoptions").getJSON(function (json) {
            MasterMod.craftingbenchoptions = json;
        }),
        new DataDependency("js/data/translations/English/mod_correct_groups.json", "#data_loader_mod_correct_groups_loc").getJSON(function (json) {
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
        
        // item scrolls fixed
        var item_fixed_top;
        
        var get_selected_mod_generator = function () {
            var $mod_generator = $("input.ModGenerator:radio:checked");
            
            if ($mod_generator.hasClass("Masterbench")) {
                return new Masterbench(mods, +$mod_generator.data('npc_master_key'));
            } else {
                return ModGeneratorFactory.build($("input.ModGenerator:radio:checked").val(), mods);
            }
        };
        
        // get localization for byteset
        ByteSet.initLocalization($("#legends"));
        
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
            
            $option.addClass(ident);
            $option.text(ident);
            $option.data("ident", ident);
            
            $option.appendTo("#item_classes");
        });
        
        // change item_class handle
        $("#item_classes").on("change", function () {
            var $selected = $("option:selected", this);
            var sub_tag = $("#item_class_sub_tag").val();
            
            // selected ItemClass
            var item_class = Item.ITEMCLASSES[$selected.data("ident")];
            if (item_class === null) {
                return false;
            }

            // baseitems that have this ItemClass
            // needs map instead of grep because table structure primary => table cols
            var baseitems = $.map(baseitemtypes, function (baseitemtype) {
                if (item_class.PRIMARY === +baseitemtype.ItemClass 
                        && (!sub_tag || baseitemtype.TagsKeys.split(",").indexOf(sub_tag) !== -1)) {
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
                $option.attr("data-baseitem_primary", baseitem_props.primary);
                $option.attr("data-name", baseitem_props.Name);
                $option.appendTo("#baseitems");
            });
            
            // select first baseitem
            $("#baseitems option:not(.template):first").prop("selected", true);
            
            // and trigger onchange
            $("#baseitems").trigger("change");
        }); 
        
        // change baseitem handle
        $("#baseitems").on("change", function () {
            // persistence
            baseitem = get_selected_baseitem();
            
            // update gui
            display_baseitem(baseitem, "#used_baseitem");
            display_available_mods(mod_generator, baseitem);  
            display_mod_gen_applicability(baseitem, mods);
        }); 
        
        var hashbang = new Hashbang();
        var hashbang_change = function () {
            var next_file;
            var mappings = {
                rings: 'RING',
                amulets: 'AMULET',
                belts: 'BELT',
                jewels: 'JEWEL',
                claws: 'CLAW',
                daggers: 'DAGGER',
                bows: 'BOW',
                quivers: 'QUIVER',
                staves: 'STAFF',
                sceptres: 'SCEPTRE',
                wands: 'WAND',
                '1h_axes': 'AXE_1H',
                '2h_axes': 'AXE_2H',
                '1h_maces': 'MACE_1H',
                '2h_maces': 'MACE_2H',
                '1h_swords': 'SWORD_1H',
                '2h_swords': 'SWORD_2H',
                'maps': 'MAP',
                armours: 'ARMOUR',
                gloves: 'GLOVES',
                boots: 'BOOTS',
                helmets: 'HELMET',
                shields: 'SHIELD'
            };
            var $baseitem;
            var sub_tag = '';
            
            // itemclass
            next_file = this.getPath().nextFile();
            
            if (mappings[next_file]) {
                $('#item_classes .item_class.' + mappings[next_file]).prop("selected", true);
            } else {
                $('#item_classes .item_class.RING').prop("selected", true);
            }
            
            if (["armours", "boots", "gloves", "helmets", "shields"].indexOf(next_file) !== -1) {
                // set links to item_class
                $("#tag_selector_req a").each(function () {
                    var $this = $(this);
                    $this.attr("href", "#!/" + next_file + "/" + $this.attr("data-sub_tag"));
                });
                
                $("#tag_selector_req").show();
            } else if (next_file === 'maps') {
                $("#tag_selector_map").show();
            } else {
                $(".sub_tag_selector").hide();
            }
            
            // sub group of itemclass? str_armour, dex_armour etc
            next_file = this.getPath().nextFile();
            if (typeof next_file === 'string') {
                // select * from tags where Id = next_file
                sub_tag = $.map(tags, function (tag) {
                    if (tag.Id === next_file) {
                        return tag;
                    }
                    return null;
                })[0];
                
                // sub_tag found
                if (sub_tag !== undefined) {
                    sub_tag = sub_tag.primary;
                    $(".sub_tag_selector").hide();
                    
                    // next directory
                    next_file = this.getPath().nextFile();
                }
            }
            $("#item_class_sub_tag").val(sub_tag);
            
            // no trigger itemclass change
            $('#item_classes').trigger("change");
            
            // baseitem
            if (typeof next_file === 'string') {
                $baseitem = $("#baseitems option:not(.template)[data-name='" + next_file.replace(/_/, " ") + "']");
                if ($baseitem.length) {
                    $baseitem.prop("selected", true);

                    next_file = this.getPath().nextFile();
                }
            }

            // TODO catch not found
            // Hashbang basic gui navigation
            if (next_file === 'withRecipe') {
                next_file = this.getPath().nextFile();
                switch (next_file) {
                    case 'no_attack_mods':
                        break;
                    case 'no_caster_mods':
                        break;
                    case 'no_attack_or_caster_mods':
                        break;
                    case 'lld_mods':
                        break;
                    default:
                        throw new NotFoundException('recipe `' + next_file + '` not found');
                        break;
                }
            }
            
        };

        // TODO doesnt work
        hashbang.onChange(hashbang_change);
        
        hashbang.withWindow(window);
        hashbang_change.apply(hashbang);
        
        $(window).on("hashchange", function () {
            hashbang.withWindow(window);
            hashbang_change.apply(hashbang);
        });

        // change modgen handle
        $("input.ModGenerator:radio").on("change", function () {
            // persistence
            mod_generator = get_selected_mod_generator();

            // update gui
            display_available_mods(mod_generator, baseitem);
            $("#use_mod_gen .name").text(mod_generator.name());
            $("#use_mod_gen .craftingbenchoption").empty();
            $("#use_mod_gen").attr("data-applicable", "");
            
            // remove craftingbenchoptions
            var $craftingbenchoptions = $("#craftingbenchoptions");
            $(".craftingbenchoption:not(.template)", $craftingbenchoptions).remove();
            
            if (mod_generator instanceof Masterbench) {
                // display options
                $.each(mod_generator.craftingbenchoptions, function (i, craftingbenchoption) {
                    // Mod atleast displayed so we also display the option
                    if ($("#" + Mod.domId(craftingbenchoption.ModsKey)).length) {
                        var $option = create_from_template(".craftingbenchoption", $craftingbenchoptions);
                        
                        $option.val(i);
                        $option.text(craftingbenchoption.Name);

                        $craftingbenchoptions.append($option);
                    }
                });
                
                // display no options hint
                $("#no_craftingbenchoptions").toggle($(".craftingbenchoption:not(.template)").length === 0);
                
                // select last option because otherwise a recently hidden
                // #no_craftingbenchoptions will still be selected in chrome
                // also selecting first visible yields to weird interactions
                // with hidden options 
                $("option:last", $craftingbenchoptions).prop("selected", true);
                $craftingbenchoptions.trigger("change");
            }
            
            $("input:radio.ModGenerator").parents(".applicable").removeClass("selected");
            // add selected class to .applicable container
            $("input:radio:checked.ModGenerator").parents(".applicable").addClass("selected");
            
        });
        
        // changed craftingbenchoption handle
        $("#craftingbenchoptions").on("change", function () {
            $("#use_mod_gen .craftingbenchoption").text($("option:selected", this).text());
        });
        
        // mod gen handle
        $("#use_mod_gen").on("click", function () {
            var args;
            var $this = $(this);
            
            console.log(mod_generator, "@", baseitem);
            
            if (!(mod_generator instanceof ModGenerator)) {
                console.log("mod_generator needs to be of type ModGenerator");
                return false;
            }
            
            if (!(baseitem instanceof Item)) {
                console.log("baseitem needs to be of type Item");
                return false;
            }
            
            // build applyTo args
            args = [baseitem];
            
            // we need the selected craftingbenchoption
            if (mod_generator instanceof Masterbench) {
                args.push(+$("#craftingbenchoptions option:selected").val());
            }
            
            // apply
            if (mod_generator.applyTo.apply(mod_generator, args)) {
                // display
                display_baseitem(baseitem, "#used_baseitem");
                display_available_mods(mod_generator, baseitem);
                display_mod_gen_applicability(baseitem, mods);
                
                $this.attr("data-applicable", true);
            } else {
                // flash error
                $this.attr("data-applicable", false);
            }

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
            var added = false;
            
            if (mod === null) {
                console.log("could not deserialize", serialized);
            }
            console.log(baseitem, "+", mod);
            
            added = baseitem.addMod(mod);
            // try at least one time to make more room for mods
            if (!added && baseitem.upgradeRarity()) {
                added = baseitem.addMod(mod);
            }
            
            if (added) {
                display_baseitem(baseitem, "#used_baseitem");
                display_available_mods(mod_generator, baseitem);
                display_mod_gen_applicability(baseitem, mods);
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
        
        // rarity handle
        $("#item_rarities").on("change", function () {
            baseitem.rarity = Item.RARITY[$("option:selected", this).val()];
            
            display_baseitem(baseitem, "#used_baseitem");
            display_available_mods(mod_generator, baseitem);
            display_mod_gen_applicability(baseitem, mods);
        });
        
        // expand mod groups
        $("#expand_mods").on("click", function () {
            console.log("expand");
            $("table.mods").addClass("expanded");
            
            $("tbody.mods:not(.template)").show();
            $("tbody.correct_group:not(.template)").hide();
        });

        // collapse mod groups = invert #expand_mods
        $("#collapse_mods").on("click", function () {
            $("table.mods").removeClass("expanded");
            
            $("tbody.mods:not(.template)").hide();
            $("tbody.correct_group:not(.template)").show();
        });
        
        // display stats with mods in itembox handle
        $("#itembox_stats_with_mods").on("change", function () {
            $(".itembox .mods .mod > *:not(.stats)").toggle($(this).prop("checked"));
        });
        
        // display group of ModGenerators handle
        $("#show_currencies").on("click", function () {
            $("#ModGenerator fieldset.currencies").toggle();
        });
        
        $("#show_masterbenches").on("click", function () {
            $("#ModGenerator fieldset.masterbenches").toggle();
        });
        
        // hide group of ModGenerators handle
        $("#ModGenerator fieldset a.close_fieldset").on("click", function () {
            $(this).parents("fieldset").hide(); 
        });
        
        item_fixed_top = $("#Item").offset().top;
        
        // #Item fixed
        $(window).on("scroll", function () {
            var $window = $(window);
            var $Item = $("#Item");
            
            var offset = $window.scrollTop() - item_fixed_top;
            if (offset > 0) {
                $Item.css({top: offset + "px"});
            }
        });
        
        // test dom handles
        
        // all affixes selected by default
        $("input.ModGenerator:radio").filter(":first").prop("checked", true);
        $("input.ModGenerator:radio").filter(":checked").trigger("change");

        //$("#prefixes tbody:not(.template) .add_mod:first").trigger("click");
        
        $("#use_mod_gen").trigger("click");
    });
}).call(this);
},{"./libs/DataDependency":3,"./libs/Hashbang":5,"./libs/Localization":7,"./libs/ModContainers/Item":9,"./libs/ModGenerators/Masterbench":20,"./libs/ModGenerators/ModGenerator":21,"./libs/ModGenerators/ModGeneratorFactory":22,"./libs/Spawnable":30,"./libs/concerns/Array":33,"./libs/concerns/ByteSet":34,"./libs/concerns/Math":35,"./libs/concerns/Number":36,"./libs/concerns/Object":37,"./libs/concerns/String":38,"./libs/mods/ApplicableMod":40,"./libs/mods/MasterMod":41,"./libs/mods/Mod":42,"./libs/mods/ModFactory":43}],2:[function(require,module,exports){
(function (__undefined) {
    var Class = require('./Inheritance');
    
    /**
     * interface Applicable
     */
    var Applicable = Class.extend({
        init: function () {
            this.applicable_byte = Applicable.SUCCESS;
        },
        applicableTo: function (mod_container) {
            
        },
        resetApplicable: function () {
            
        },
        applicableByteHuman: function () {
            
        },
        applicableCached: function () {
            
        }
    });
    
    Applicable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            if (Applicable.implementedBy(mod)) {
                mod.applicableTo(mod_container);
            }
            return mod;
        });
    };
    
    Applicable.mods = function (mod_collection, mod_container, success) {
        return $.grep(mod_collection.slice(), function (mod) {
            return Applicable.implementedBy(mod) && mod.applicableTo(mod_container, success);
        });
    };
    
    // interface pattern
    Applicable.implementedBy = function (clazz) {
        return  clazz.applicableTo !== __undefined;
    };
    
    Applicable.UNSCANNED = 0;
    Applicable.SUCCESS = 1;
    
    module.exports = Applicable;
}).call(this);
},{"./Inheritance":6}],3:[function(require,module,exports){
(function (__undefined) {
    var Class = require('./Inheritance');
    require('./concerns/Array');
    
    if (window.jQuery === __undefined) {
        console.error("need jQuery object with window context");
        return;
    }
    var $ = window.jQuery;
    
    /**
     * class DataDependency
     * 
     * class for loading a json data
     */
    var DataDependency = Class.extend({
        /**
         * 
         * @param {String} path path to json data
         * @param {String} loading_indicator jquery selector for loading indicator class
         * @returns {DataDependency}
         */
        init: function (path, loading_indicator) {
            this.path = path;
            this.loading_indicator = loading_indicator;
            
            this.state_attr = DataDependency.STATE_ATTR;
        },
        /**
         * returns $.getJSON 
         * 
         * @param {Function} done callback on $.ajax.done
         * @returns {$.Dereferred}
         */
        getJSON: function (done) {
            var that = this;
            $(this.loading_indicator).attr(this.state_attr, DataDependency.STATE.LOADING);
            
            return $.getJSON(this.path, done)
                .done(function () {
                    $(that.loading_indicator).attr(that.state_attr, DataDependency.STATE.DONE);
                })
                .fail(function () {
                    $(that.loading_indicator).attr(that.state_attr, DataDependency.STATE.FAIL);
                });
        }
    });
    
    DataDependency.STATE = {
        LOADING: 1,
        DONE: 2,
        FAIL: 3
    };
    
    /**
     * default loading state attr
     */
    DataDependency.STATE_ATTR = "data-loading-state";
    
    module.exports = DataDependency;
}).call(this);
},{"./Inheritance":6,"./concerns/Array":33}],4:[function(require,module,exports){
(function (__undefined) {
    var Class = require('./Inheritance');
    require('./concerns/Array');
    
    if ($ === __undefined) {
        var $ = require('./jquery/jquery_node');
    }
    
    /**
     * table row from content.ggpk
     */
    var GgpkEntry = Class.extend({
        init: function (props) {
            this.props = props;
        },
        /**
         * comma separated values are arrays
         * already int cast if possible
         * 
         * @param {string} key
         * @returns {Array}
         */
        valueAsArray: function (key) {
            // filter(empty) + map(parseInt)
            return $.map(this.getProp(key).split(","), function (n) {
                if (n === null || n === '') {
                    return null;
                }
                
                if (isNaN(+n)) {
                    return n;
                }
                return +n;
            });
        },
        getProp: function (key) {
            if (this.props[key] === __undefined) {
                console.log("key `" + key + "` doesnt exist");
            }
            return this.props[key];
        },
        setProp: function (key, value) {
            if (this.props[key] !== __undefined) {
                this.props[key] = value;
            }
        }
    });
    
    module.exports = GgpkEntry;
}).call(this);
},{"./Inheritance":6,"./concerns/Array":33,"./jquery/jquery_node":39}],5:[function(require,module,exports){
(function (__undefined) {
    var Class = require('./Inheritance');
    var Path = require('./Path');
    
    var Hashbang = Class.extend({
        init: function (prefix) {
            this.params = {};
            this.path = new Path("");
            this.prefix = prefix;
            
            this.on_change = null;
        },
        onChange: function (cb) {
            this.on_change = cb;
        },
        triggerChange: function () {
            if (typeof this.on_change === 'function') {
                return this.on_change.apply(this);
            }
        },
        /**
         * 
         * @param {String} key
         * @param {Mixed} value
         * @returns {Hashbang} this to chain
         */
        setParams: function (key, value) {
            this.params[key] = value;
            
            // chainable
            return this;
        },
        getPath: function () {
            return this.path;
        },
        /**
         * 
         * @param {String} path
         * @returns {Hashbang} this to chain
         */
        setPath: function (path) {
            this.path = new Path(path);
            
            // chainable
            return this;
        },
        /**
         * generates url from class properties
         * @returns {String}
         */
        url: function () {
            var url = "#" + this.prefix + this.path;
            
            if (!$.isEmptyObject(this.params)) {
                url += "?" + Hashbang.query_string(this.params);
            }
            
            return url;
        },
        parse: function (url) {
            this.init();
            
            if (typeof url !== 'string') {
                return this;
            }

            var url_match = url.match(/!([\w\/]+)(\?.*)?/);
            if (url_match !== null) {
                this.setPath(url_match[1]);
                this.setParams(url_match[2]);
                this.triggerChange();
            }

            return this;
        },
        withWindow: function (window) {
            return this.parse(window.location.hash.slice(1));
        }
    });
    
    Hashbang.fromWindow = function (window) {
        return new Hashbang().withWindow(window);
    };
    
    Hashbang.parse = function (url) {
        return new Hashbang.parse(url);
    };
    
    Hashbang.query_string = function (params) {
        return $.map(params, function (value, key) {
            return key + "=" + value;
        }).join("&");
    };
    
    module.exports = Hashbang;
}).call(this);
},{"./Inheritance":6,"./Path":28}],6:[function(require,module,exports){
/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
(function(){
  var initializing = false, fnTest = /xyz/.test(function(){xyz;}) ? /\b_super\b/ : /.*/;
 
  // The base Class implementation (does nothing)
  var Class = function(){};
 
  // Create a new Class that inherits from this class
  Class.extend = function(prop) {
    var _super = this.prototype;
   
    // Instantiate a base class (but only create the instance,
    // don't run the init constructor)
    initializing = true;
    var prototype = new this();
    initializing = false;
   
    // Copy the properties over onto the new prototype
    for (var name in prop) {
      // Check if we're overwriting an existing function
      prototype[name] = typeof prop[name] == "function" &&
        typeof _super[name] == "function" && fnTest.test(prop[name]) ?
        (function(name, fn){
          return function() {
            var tmp = this._super;
           
            // Add a new ._super() method that is the same method
            // but on the super-class
            this._super = _super[name];
           
            // The method only need to be bound temporarily, so we
            // remove it when we're done executing
            var ret = fn.apply(this, arguments);        
            this._super = tmp;
           
            return ret;
          };
        })(name, prop[name]) :
        prop[name];
    }
   
    // The dummy class constructor
    function Class() {
      // All construction is actually done in the init method
      if ( !initializing && this.init )
        this.init.apply(this, arguments);
    }
   
    // Populate our constructed prototype object
    Class.prototype = prototype;
   
    // Enforce the constructor to be what we expect
    Class.prototype.constructor = Class;
 
    // And make this class extendable
    Class.extend = arguments.callee;
   
    return Class;
  };
  
  module.exports = Class;
})();
},{}],7:[function(require,module,exports){
/* jshint bitwise:false */
(function (__undefined) {
    var Class = require("./Inheritance");
    
    require('./concerns/Array');
    require('./concerns/Object');
    
    if ($ === __undefined) {
        var $ = require('./jquery/jquery_node');
    }
    
    /**
     * class Localization
     * 
     * class for localizing a group of entities
     */
    var Localization = Class.extend({
        /**
         * 
         * @param {Object} data the localization json data
         * @returns {Localization}
         */
        init: function (data) {
            this.data = data;
        },
        /**
         * 
         * @param {string} key
         * @param {*} ...args params for Localization::lookupString
         * @returns {Localization::lookupString}
         */
        t: function (key) {
            var params = Array.prototype.slice.call(arguments, 1);
            return Localization.fillString(this.lookupString(key, params), params);
        },
        /**
         * checks all possible strings from key against the params
         * @param {string} key
         * @param {array} params
         * @returns {Object|Class@call;extend.fillString.string}
         */
        lookupString: function (key, params) {
            var used_option = null;
            
            if (this.data[key] === __undefined) {
                return null;
            }
            
            // every option
            $.each(this.data[key], function (i, option) {
                if (isNaN(+i)) {
                    // continue on string keys
                    return true;
                }
                
                var and_bit = 1;
                // loop through every and condition
                $.each(option.and, function (j, range_string) {
                    and_bit &= +Localization.inRange(range_string, params[j]);
                    if (!and_bit) {
                        // break;
                        return false;
                    }
                });
                
                if (and_bit) {
                    used_option = option;
                    // break;
                    return false;
                }
            });
            
            if (used_option === null) {
                //console.log("no valid match for", this.data[key], "with", params);
                
                return null;
            }

            if (used_option.handles) {
                $.each(used_option.handles, function (i, handle) {
                    params[i-1] = $.map(params[i-1], Localization.handles[handle]);
                });
            }
            
            if (!used_option.text) {
                console.log(this.data[key], used_option);
            }
            
            return used_option.text;
        }
    });
    
    /**
     * replaces the params within the string with the given params
     * 
     * @param {String} string
     * @param {Array} params
     * @returns {String}
     */
    Localization.fillString = function (string, params) {
        $.each(params, function (i, param) {
            string = string.replace("{param_" + (i + 1) + "}", Localization.rangeString(param));
        });
        
        return string;
    };
    
    /**
     * checks if values are within a range_string from the poe desc files 
     * @param {type} range_string
     * @param {type} values
     * @returns {Boolean}
     */
    Localization.inRange = function (range_string, values) {
        if (range_string === __undefined || values === __undefined) {
            return false;
        }
        var range = range_string.split("|");
        var value = Math.max.apply(Math, values);
             
        if (range.length === 1 && (+range[0] === +value || range[0] === '#')) {
            return true;
        }
        
        if (range[0] === '#') {
            range[0] = Number.NEGATIVE_INFINITY;
        }
        if (range[1] === '#') {
            range[1] = Number.POSITIVE_INFINITY;
        }
        
        if (+range[0] <= +value && +value <= +range[1]) {
            return true;
        }
        return false;
    };
    
    Localization.rangeString = function (range) {
        if (range.length < 2 || range[0] === range[1]) {
            return range[0];
        }
        return "(" + range.join(" to ") + ")";
    };
    
    /**
     * lambdas  for parameter handles
     */
    Localization.handles = {
        deciseconds_to_seconds: function (i) {
            return i * 10;
        },
        divide_by_one_hundred: function (i) {
            return i / 100;
        },
        per_minute_to_per_second: function (i) {
            return i / 60;
        },
        milliseconds_to_seconds: function (i) {
            return i / 1000;
        },
        negate: function (i) {
            return -i;
        },
        divide_by_one_hundred_and_negate: function (i) {
            return -i / 100;
        },
        old_leech_percent: function (i) {
            return i / 5;
        },
        old_leech_permyriad: function (i) {
            return i / 50;
        },
        per_minute_to_per_second_0dp: function (i) {
            return parseInt(Math.round(i / 60, 0), 10);
        },
        per_minute_to_per_second_2dp: function (i) {
            return parseInt(Math.round(i / 60, 2), 10);
        },
        milliseconds_to_seconds_0dp: function (i) {
            return parseInt(Math.round(i / 1000, 0), 10);
        },
        milliseconds_to_seconds_2dp: function (i) {
            return parseInt(Math.round(i / 1000, 2), 10);
        },
        multiplicative_damage_modifier: function (i) {
            return i;
        },
        mod_value_to_item_class: function (i) {
            return i;
        }
    };
    
    module.exports = Localization;
}).call(this);
},{"./Inheritance":6,"./concerns/Array":33,"./concerns/Object":37,"./jquery/jquery_node":39}],8:[function(require,module,exports){
(function (__undefined) {
    var Class = require('./Inheritance');
    
    /**
     * class Metadata
     * 
     * representation of a .ot file in METADATA 
     */
    var MetaData = Class.extend({
        init: function (clazz, props) {
            this.clazz = clazz;
            this.props = props;
        },
        isA: function (clazz) {
            return clazz === this.clazz || 
                    this.props.inheritance.indexOf(clazz) !== -1;
        },
        valueOf: function (fascade, key, expect) {
            if (this.props[fascade] && this.props[fascade][key]) {
                switch (expect) {
                    case MetaData.EXPECT.STRING:
                        return this.props[fascade][key][0];
                    case MetaData.EXPECT.NUMBER:
                        return +this.props[fascade][key][0];
                    case MetaData.EXPECT.ARRAY:
                        return this.props[fascade][key];
                    default:
                        console.log("IllegalArgument for valueOf(fascade, key, expect)", fascade, key, expect);
                        return null;
                }
            }
            return __undefined;
        }
    });
    
    MetaData.build = function (clazz, meta_datas) {
        var meta_data = meta_datas[clazz];
        if (meta_data === __undefined) {
            return null;
        }
        
        return new MetaData(clazz, meta_data);
    };
    
    MetaData.EXPECT = {
        NUMBER: 1,
        STRING: 2,
        ARRAY: 3
    };
    
    module.exports = MetaData;
}).call(this);
},{"./Inheritance":6}],9:[function(require,module,exports){
(function (__undefined) {
    var ModContainer = require('./ModContainer');
    var MetaData = require('../MetaData');
    var Mod = require('../mods/Mod');
    var ValueRange = require('../ValueRange');
    var GgpkEntry = require('../GgpkEntry');
    var ItemImplicits = require('./ItemImplicits');
    var ApplicableMod = require('../mods/ApplicableMod');
    
    if ($ === __undefined) {
        var $ = require('../jquery/jquery_node');
    }
    
    /**
     * 
     * Item Class extends @link ModContainer
     * 
     * represents an ingame item (boots, maps, rings for example)
     * the class only represents the explicits and is a fascade for an 
     * additional implicit container
     */
    var Item = ModContainer.extend({
        /**
         * @constructor
         * @param {Object} props for @link GgpkEntry
         * @returns {Item}
         */
        init: function (props) {
            var that = this;
            if (Item.meta_data === null) {
                console.log("pls init meta data");
                return null;
            }
            
            // explicits
            this._super();
            
            // default
            this.rarity = Item.RARITY.NORMAL;
            this.item_level = Item.MAX_ILVL;
            this.random_name = "Random Name";
            
            // parse entry
            this.entry = new GgpkEntry(props);
            
            // get meta data key
            // path.split(/[\\/]/).pop() := basename 
            var clazz = this.entry.getProp("InheritsFrom").split(/[\\/]/).pop();
            
            // meta data exists?
            this.meta_data = MetaData.build(clazz, Item.meta_data);
            
            // implicits
            this.implicits = new ItemImplicits([]);
            $.each(this.entry.valueAsArray("Implicit_ModsKeys"), function (_, mod_key) {
                if (!that.implicits.addMod(new ApplicableMod(Mod.mods[mod_key]))) {
                    console.log("could not add", mod_key);
                }
            });
        },
        /**
         * adds a mod if theres room for it
         * no sophisticated domain check. only if affix type is full or not
         * 
         * @override
         * @param {Mod} mod
         * @returns {Boolean} true on success
         */
        addMod: function (mod) {
            if (!(mod instanceof Mod)) {
                return false;
            }
            
            if (mod.isPrefix() && this.getPrefixes().length < this.maxPrefixes() || 
                    mod.isSuffix() && this.getSuffixes().length < this.maxSuffixes()
            ) {
                return this._super(mod);
            }
            return false;
        },
        /**
         * @param {Mod} mod
         * @returns {Boolean} true on success
         */
        addImplicits: function (mod) {
            return this.implicits.addMod(mod);
        },
        /**
         * ItemImplicts fascade
         * @returns {ModContainer@call;removeAllMods}
         */
        removeAllImplicits: function () {
            return this.implicits.removeAllMods();
        },
        /**
         * ItemImplicits fascade
         * @param {Mod} mod
         * @returns {ModContainer@call;removeMod}
         */
        removeImplicits: function (mod) {
            return this.implicits.removeMod(mod);
        },
        /**
         * ItemImplicits fascade
         * @param {Number} primary
         * @returns {ModContainer@call;getMod}
         */
        getImplicit: function (primary) {
            return this.implicits.getMod(primary);
        },
        /**
         * ItemImplicits fascade
         * @param {Number} primary
         * @returns {ModContainer@call;inMods}
         */
        inImplicits: function (primary) {
            return this.implicits.inMods(primary);
        },
        /**
         * adds a new tag to the item if its not already presen
         * 
         * @param {int} tag_key
         * @returns {Boolean} true on success
         */
        addTag: function (tag_key) {
            if (this.tags.indexOf(tag_key) === -1) {
                this.tags.push(tag_key);
                return true;
            }
            return false;
        },
        /**
         * removes an existing tag
         * 
         * @param {int} tag_key
         * @returns {Boolean} true on success
         */
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
            return $.unique(this._super().concat(this.meta_data.props.tags, this.entry.valueAsArray("TagsKeys")));
        },
        /**
         * returns the max possible number of the given generation type
         * 
         * @override
         * @param {Mod} mod
         * @returns {Number} max number or -1 if not possible at all
         */
        maxModsOfType: function (mod) {
            var generation_type = +mod.getProp("GenerationType");
            
            switch (generation_type) {
                case Mod.MOD_TYPE.PREFIX:
                    return this.maxPrefixes();
                case Mod.MOD_TYPE.SUFFIX:
                    return this.maxSuffixes();
                case Mod.MOD_TYPE.ENCHANTMENT:
                case Mod.MOD_TYPE.TALISMAN:
                    return 1;
            }
            
            return -1;
        },
        /**
         * maximum number of prefixes
         * 
         * @returns {Number}
         */
        maxPrefixes: function () {
            switch (this.rarity) {
                case Item.RARITY.NORMAL:
                    return 0;
                case Item.RARITY.MAGIC:
                    return 1;
                case Item.RARITY.RARE:
                case Item.RARITY.SHOWCASE:
                    if (this.meta_data.isA("AbstractJewel")) {
                        return 2;
                    }
                    return 3;
                case Item.RARITY.UNIQUE:
                    return Number.POSITIVE_INFINITY;
            }
        },
        /**
         * maximum number of suffixes (=prefixes)
         * 
         * @returns {String}
         */
        maxSuffixes: function () {
            return this.maxPrefixes();
        },
        /**
         * equiv mod domain
         * 
         * @returns {Mod.DOMAIN.*}
         */
        modDomainEquiv: function () {
            if (this.meta_data.isA("AbstractJewel")) {
                return Mod.DOMAIN.JEWEL;
            }
            if (this.meta_data.isA("AbstractFlask")) {
                return Mod.DOMAIN.FLASK;
            }
            if (this.meta_data.isA("AbstractMap")) {
                return Mod.DOMAIN.MAP;
            }
            return Mod.DOMAIN.ITEM;
        },
        /**
         * checks if the domains are equiv
         * 
         * @param {Mod.DOMAIN.*} mod_domain
         * @returns {Boolean} true if in domain
         */
        inDomainOf: function (mod_domain) {
            switch (mod_domain) {
                case Mod.DOMAIN.MASTER:
                    return this.inDomainOf(Mod.DOMAIN.ITEM);
                default:
                    return mod_domain === this.modDomainEquiv();
            }
        },
        getImplicits: function () {
            return this.implicits.asArray();
        },
        getAllMods: function () {
            return this.asArray().concat(this.getImplicits());
        },
        /**
         * name of the base_item
         * @returns {String}
         */
        baseName: function () {
            if (this.rarity === Item.RARITY.MAGIC) {
                return "";
            }
            return this.entry.getProp("Name");
        },
        /**
         * actual item name
         * @returns {String}
         */
        itemName: function () {
            switch (this.rarity) {
                case Item.RARITY.MAGIC:
                    var name = "";
                    // prefix
                    if (this.getPrefixes().length) {
                        name += this.getPrefixes()[0].getProp("Name") + " ";
                    }
                    // + base_name
                    name += this.entry.getProp("Name");
                    // + suffix
                    if (this.getSuffixes().length) {
                        name += " " + this.getSuffixes()[0].getProp("Name");
                    }
                    
                    return name;
                case Item.RARITY.RARE:
                    return this.random_name;
            }
            return '';
        },
        /**
         * primary key
         * @returns {Number}
         */
        primary: function () {
            return +this.entry.getProp("Rows");
        },
        /**
         * requirements to wear this item
         * 
         * @returns {Object} requirement desc => amount
         */
        requirements: function () {
            var requirements = {};
            
            $.each({
                Level: this.requiredLevel(),
                Str: this.entry.getProp("ReqStr"),
                Dex: this.entry.getProp("ReqDex"),
                Int: this.entry.getProp("ReqInt")
            }, function (key, requirement) {
                if (requirement > 0) {
                    requirements[key] = requirement;
                }
            });
            
            return requirements;
        },
        requiredLevel: function () {
            return Math.max.apply(Math, [+this.entry.getProp("DropLevel")].concat($.map(this.getAllMods(), function (mod) {
                return Math.floor(0.8 * +mod.getProp("Level"));
            })));
        },
        /**
         * string identifier of the item_class
         * 
         * @returns {String} key from @link Item.ITEMCLASSES
         */
        itemclassIdent: function () {
            var that = this;
            return $.map(Item.ITEMCLASSES, function (itemclass, ident) {
                if (+itemclass.PRIMARY === +that.entry.getProp("ItemClass")) {
                    return ident;
                }
                return null;
            })[0];
        },
        /**
         * string identifier of the item rarity
         * 
         * @returns {String} key from @link Item.RARITY
         */
        rarityIdent: function () {
            var that = this;
            return $.map(Item.RARITY, function (rarity, ident) {
                if (rarity === +that.rarity) {
                    return ident.toLowerCase();
                }
                return null;
            })[0];
        },
        /**
         * attempts to upgrade the rarity
         * 
         * @returns {Boolean} true on change in rarity
         */
        upgradeRarity: function () {
            switch (this.rarity) {
                case Item.RARITY.NORMAL:
                case Item.RARITY.SHOWCASE:
                    this.rarity = Item.RARITY.MAGIC;
                    return true;
                case Item.RARITY.MAGIC:
                    this.rarity = Item.RARITY.RARE;
                    return true;
            }
            
            return false;
        },
        /**
         * stats of mods combined
         * 
         * @returns {Object} stat_id => value
         */
        stats: function () {
            var stats = {};
            
            // flatten mods.statsJoined()
            $.each($.map(this.asArray().concat(this.getImplicits()), function (mod) {
                return mod.statsJoined();
            }), function (_, stat) {
                var id = stat.getProp("Id");
                // group by stat.Id
                if (stats[id]) {
                    stats[id].values.add(stat.values);
                } else {
                    stats[id] = stat;
                }
            });
            
            return stats;
        },
        /**
         * stats from the item with stats from mods applied
         * 
         * @returns {Object} desc => valuerange
         */
        localStats: function () {
            var stats = this.stats();
            var local_stats = {};
            
            // TODO quality
            
            if (this.meta_data.isA('AbstractWeapon')) {
                // added flat
                $.each({
                    "physical":  new ValueRange(+this.entry.getProp("DamageMin"),
                                                +this.entry.getProp("DamageMax")),
                    "fire": new ValueRange(0, 0),
                    "cold": new ValueRange(0, 0),
                    "lightning": new ValueRange(0, 0),
                    "chaos": new ValueRange(0, 0)
                }, function (source, damage) {
                    if (stats['local_minimum_added_' + source + '_damage']) {
                        damage.min = stats['local_minimum_added_' + source + '_damage'].values.add(damage.min);
                    }     

                    if (stats['local_maximum_added_' + source + '_damage']) {
                        damage.max = stats['local_maximum_added_' + source + '_damage'].values.add(damage.max);
                    } 

                    // TODO combine ele damage
                    if (!damage.isZero()) {
                        local_stats[source.ucfirst() + ' Damage'] = damage;
                    }
                });
                
                // TODO combine ele
                
                // apply increases
                local_stats['Physical Damage'] = 
                        Item.applyStat(local_stats['Physical Damage'],
                                       stats['local_physical_damage_+%'],
                                       0);
                
                // Crit
                local_stats['Critical Strike Chance'] = 
                        Item.applyStat(+this.entry.getProp('Critical') / 100,
                                       stats['local_critical_strike_chance_+%'],
                                       2).toString() + "%";
                                    
                // APS
                local_stats['Attacks Per Second'] = 
                        Item.applyStat(1000 / +this.entry.getProp("Speed"),
                                       stats['local_attack_speed_+%'],
                                       2);
            } else if (this.meta_data.isA('AbstractArmour')) {
                var that = this;
                // defences
                $.each({
                    // ComponentArmour => stat_name
                    Armour: "physical_damage_reduction",
                    Evasion: "evasion",
                    EnergyShield: "energy_shield"
                }, function (component, stat) {
                    // inital value
                    local_stats[component] = new ValueRange(+that.entry.getProp(component),
                                                            +that.entry.getProp(component));
                    
                    // added flat
                    if (stats['local_base_' + stat + '_rating']) {
                        local_stats[component] = local_stats[component].add(stats['local_base_' + stat + '_rating'].values);
                    }
                    
                    // increase
                    local_stats[component] = 
                            Item.applyStat(local_stats[component],
                                           stats['local_' + stat + '_rating_+%'],
                                           0);
                    
                    if (local_stats[component].isZero()) {
                        delete local_stats[component];
                    }
                });
            }
            
            // TODO color stats
            return local_stats;
        }
    });
    
    /**
     * takes a increased stat and applies it to the value
     * 
     * @param {ValueRange|Number} value
     * @param {Stat} stat
     * @param {Number} precision
     * @returns {ValueRange}
     */
    Item.applyStat = function (value, stat, precision) {
        var result = null;
        
        if (stat === __undefined) {
            result = value;
        } else {
            // 100% increased := 2 = (100% / 100) + 1
            var multiplier = stat.values.multiply(1 / 100).add(1);


            if (value instanceof ValueRange) {
                result = value.multiply(multiplier);
            } else {
                result = multiplier.multiply(value);
            }
        }
        
        return result.toFixed(precision);
    };
    
    /**
     * meta data object uninitialized
     */
    Item.meta_data = null;
    
    /**
     * all possible rarities
     */
    Item.RARITY = {
        NORMAL: 1,
        MAGIC: 2,
        RARE: 3,
        UNIQUE: 4,
        SHOWCASE: 5
    };
    
    /**
     * maximum item level
     */
    Item.MAX_ILVL = 100;
    
    /* tags are obsolte. they are derivated from the inheritance chain
     * they are kept for historic reasons */
    Item.ITEMCLASSES = {
        AMULET: {
            PRIMARY: 5, 
            // amulet, default
            TAGS: [3, 0]
        },
        RING: {
            PRIMARY: 6, 
            // ring, default
            TAGS: [2, 0]
        },
        CLAW: {
            PRIMARY: 7, 
            // claw, onehandweapon, weapon
            TAGS: [14, 81, 8]
        },
        DAGGER: { 
            PRIMARY: 8, 
            // dagger, onehandweapon, weapon
            TAGS: [13, 81, 8]
        },
        WAND: { 
            PRIMARY: 9, 
            // wand, onehandweapon, weapon, ranged
            TAGS: [9, 81, 8, 32]
        },
        SWORD_1H: { 
            PRIMARY: 10, 
            // sword, onehandweapon, weapon
            TAGS: [12, 81, 8]
        },
        THRUSTING_SWORD_1H: {
            PRIMARY: 11, 
            // sword, onehandweapon, weapon
            TAGS: [12, 81, 8]
        },
        AXE_1H: {
            PRIMARY: 12, 
            // axe, onehandweapon, weapon
            TAGS: [15, 81, 8]
        },
        MACE_1H: { 
            PRIMARY: 13, 
            // mace, onehandweapon, weapon
            TAGS: [11, 81, 8]
        },
        BOW: {
            PRIMARY: 14,
            // bow, twohandweapon, weapon, ranged
            TAGS: [5, 82, 8, 32]
        },
        STAFF: { 
            PRIMARY: 15, 
            // Staff, twohandweapon, weapon
            TAGS: [10, 82, 8]
        },
        SWORD_2H: { 
            PRIMARY: 16, 
            // sword, twohandweapon, weapon
            TAGS: [12, 82, 8]
        },
        AXE_2H: { 
            PRIMARY: 17, 
            // axe, twohandweapon, weapon
            TAGS: [15, 82, 8]
        },
        MACE_2H: {
            PRIMARY: 18, 
            // mace, twohandweapon, weapon
            TAGS: [11, 82, 8]
        },
        QUIVER: {
            PRIMARY: 21, 
            // quiver, default
            TAGS: [21, 0]
        },
        BELT: {
            PRIMARY: 22, 
            // belt, default
            TAGS: [26, 0]
        },
        GLOVES: {
            PRIMARY: 23, 
            // gloves, armour, default
            TAGS: [22, 7, 0]
        },
        BOOTS: {
            PRIMARY: 24, 
            // boots, armour, default
            TAGS: [4, 7, 0]
        },
        ARMOUR: {
            PRIMARY: 25, 
            // body_armour, armour, default
            TAGS: [16, 7, 0]
        },
        HELMET: {
            PRIMARY: 26, 
            // helmet, armour, default
            TAGS: [25, 7, 0]
        },
        SHIELD: { 
            PRIMARY: 27, 
            // shield, armour, default
            TAGS: [1, 7, 0]
        },
        SCEPTRE: {
            PRIMARY: 33, 
            // sceptre, onehandweapon, weapon
            TAGS: [37, 81, 8]
        },
        MAP: {
            PRIMARY: 36, 
            // default
            TAGS: [0]
        },
        FISHING_ROD: {
            PRIMARY: 38, 
            // fishing_rod
            TAGS: [80]
        },
        MAP_FRAGMENT: { 
            PRIMARY: 39,
            TAGS: []
        },
        JEWEL: {
            PRIMARY: 42, 
            // default
            TAGS: [0]
        }
    };
    
    module.exports = Item;
}).call(this);


},{"../GgpkEntry":4,"../MetaData":8,"../ValueRange":32,"../jquery/jquery_node":39,"../mods/ApplicableMod":40,"../mods/Mod":42,"./ItemImplicits":10,"./ModContainer":11}],10:[function(require,module,exports){
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
                return 5;
            } 
            return -1;
        }
    });
    
    module.exports = ItemImplicits;
}).call(this);
},{"../mods/Mod":42,"./ModContainer":11}],11:[function(require,module,exports){
(function (__undefined) {
    'use strict';
    
    var Class = require("../Inheritance");
    var Mod = require("../mods/Mod");
    
    if ($ === __undefined) {
        var $ = require('../jquery/jquery_node');
    }
    
    /*
     * ModContainer class
     * 
     * Container for @link Mod
     */
    var ModContainer = Class.extend({
        /**
         * @constructor
         * @param {Array} mods all mods
         * @returns {ModContainer}
         */
        init: function (mods) {
            if (mods === __undefined) {
                this.mods = [];
            } else {
                this.mods = mods;
            }
            /**
             * @var this.mods Array<Mod>
             */
            
            this.tags = [];
        },
        /**
         * adds a new non-existing mod
         * 
         * @param {Mod} new_mod
         * @returns {Boolean} true on success
         */
        addMod: function (new_mod) {
            if (!(new_mod instanceof Mod)) {
                return false;
            }
            if (this.inMods(new_mod.getProp("Rows")) === -1) {
                this.mods.push(new_mod);
                return true;
            }
            return false;
        },
        /**
         * truncates mods
         * @returns {void}
         */
        removeAllMods: function () {
            this.mods = [];
        },
        /**
         * removes an existing mod
         * 
         * @param {type} old_mod
         * @returns {Number|Boolean} false if non-existing
         */
        removeMod: function (old_mod) {  
            var index = this.inMods(old_mod.getProp("Rows"));
            if (index !== -1) {
                this.mods.splice(index, 1);
                return index;
            }
            return false;
        },
        /**
         * gets a mod by primary
         * 
         * @param {type} primary
         * @returns {Mod} null if not existing
         */
        getMod: function (primary) {
            var index = this.inMods(primary);
            
            if (index !== -1) {
                return this.mods[index];
            }
            return null;
        },
        /**
         * checks if a mod is in the container
         * 
         * @param {Number} primary primary of the mod
         * @returns {Number} index of the mods
         */
        inMods: function (primary) {
            var index = -1;
            
            $.each(this.mods, function (i, mod) {
                if (+mod.getProp("Rows") === +primary) {
                    index = i;
                    return false;
                }
            });
            
            return index;
        },
        /**
         * returns tags of the mods in the container
         * @returns {Array}
         */
        getTags: function () {
            // jQuery map already flattens
            return $.unique($.map(this.mods, function (mod) {
                return mod.valueAsArray("TagsKeys");
            }));
        },
        /**
         * intersects all tags with the ones on the item
         * 
         * @param {Array} all_tags
         * @returns {Array} tags from the item with their properties
         */
        getTagsWithProps: function (all_tags) {
            var tags = this.getTags();
            return $.grep(all_tags, function (tag_props) {
                return tags.indexOf(+tag_props.Rows) !== -1;
            });
        },
        /**
         * all prefix mods
         * 
         * @returns {Array}
         */
        getPrefixes: function () {
            return $.grep(this.mods, function (mod) {
                return mod.isPrefix();
            });
        },
        /**
         * all suffix mods
         * 
         * @returns {Array}
         */
        getSuffixes: function () {
            return $.grep(this.mods, function (mod) {
                return mod.isSuffix();
            });
        },
        /**
         * suffixes and prefixes
         * 
         * @returns {Array}
         */
        getAffixes: function () {
            // rather order the mods than mix em up
            return this.getPrefixes().concat(this.getSuffixes());
        },
        /**
         * all mods 
         */
        asArray: function () {
            return this.mods;
        },
        /**
         * 
         * @param {Number} mod_type searched GenerationType
         * @returns {Number}
         */
        numberOfModsOfType: function (mod_type) {
            return $.grep(this.mods, function (mod) {
                return +mod.getProp("GenerationType") === mod_type;
            }).length;
        },
        /**
         * checks if theres more place for a mod with their generationtype
         * 
         * @param {Mod} mod
         * @returns {Boolean} true if room for
         */
        hasRoomFor: function (mod) {
            return this.numberOfModsOfType(+mod.getProp("GenerationType")) < this.maxModsOfType(mod);
        },
        /**
         * @abstract
         * @param {type} mod
         * @returns {Number}
         */
        maxModsOfType: function (mod) {
            console.log("override abstract maxModsOfType");
            return -1;
        }
    }); 
    
    module.exports = ModContainer;
}).call(this);
},{"../Inheritance":6,"../jquery/jquery_node":39,"../mods/Mod":42}],12:[function(require,module,exports){
/* jshint bitwise: false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../concerns/ByteSet');
    
    /**
     * class Alchemy extends Currency
     * 
     * ingame representation of Orb of Alchemy
     * mod generation most likely not accurate because we just roll 4-6 mods
     * and correlate #prefixs/suffixes to eache other if the ratio >= 3:1
     */
    var Alchemy = Currency.extend({
        /**
         * @constructor
         * @param {type} all_mods
         * @returns {Alchemy}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Alchemy";
        },
        /**
         * adds 4-6
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) {
            var i;
            var new_mods;
            var prefixes, suffixes;
            
            if (this.applicableTo(item)) {
                // upgrade to rare
                item.rarity = Item.RARITY.RARE;

                for (i = 1, new_mods = Math.rand(4, 6); i <= new_mods; ++i) {
                    item.addMod(this.chooseMod(item));
                }
                
                prefixes = item.getPrefixes().length;
                suffixes = item.getSuffixes().length;
                
                // correct differences between #prefixes, #suffixes >= 2
                for (i = 1, new_mods = Math.max(0, Math.abs(prefixes - suffixes) - 1); i <= new_mods; ++i) {
                    item.addMod(this.chooseMod(item));
                }
                
                return true;
            }
            
            return false;
        },
        /**
         * maps mod::applicableTo as if it were already magic
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.RARE;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * greps mod::applicableTo as if it were already rare
         * @param {type} item
         * @param {type} success
         * @returns {Array}
         */
        mods: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.RARE;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.NORMAL) {
                this.applicable_byte |= Alchemy.APPLICABLE_BYTE.NOT_WHITE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Alchemy.APPLICABLE_BYTE, 
                                 Alchemy.APPLICABLE_BYTE.SUCCESS, 
                                 "Alchemy.applicable_byte");
        }
    });
    
    Alchemy.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_WHITE: 4
    };
    
    module.exports = Alchemy;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../concerns/ByteSet":34,"../jquery/jquery_node":39,"./Currency":16,"./Transmute":26}],13:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    
    var ByteSet = require('../concerns/ByteSet');
    /**
     * class Augment extends Currency
     * 
     * represantation of Orb of Augmentation
     */
    var Alteration = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Alteration}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Alteration";
        },
        /**
         * adds one random property
         * 
         * @param {Item} item
         * @returns {Boolean} @link Item::addMod
         */
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                // TODO actually considers *_cannot_be_changed?
                // granted via scouring but is this true for ingame alts?
                new Scouring().applyTo(item);
                // no complete scour?
                if (!(new Transmute(this.available_mods).applyTo(item))) {
                    new Augment(this.available_mods).applyTo(item);
                }
                
                return true;
            }
            
            return false;
        },
        /**
         * item needs to be magic
         * 
         * @param {Item} baseitem
         * @param {Byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.MAGIC) {
                this.applicable_byte |= Alteration.APPLICABLE_BYTE.NOT_MAGIC;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Alteration.APPLICABLE_BYTE, 
                                 Alteration.APPLICABLE_BYTE.SUCCESS, 
                                 "Alteration.applicable_byte");
        }
    });
    
    Alteration.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_MAGIC: 4
    };
    
    module.exports = Alteration;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../concerns/ByteSet":34,"./Currency":16,"./Transmute":26}],14:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../concerns/ByteSet');
    /**
     * class Augment extends Currency
     * 
     * represantation of Orb of Augmentation
     */
    var Augment = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Augment}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Augment";
        },
        /**
         * adds one random property
         * 
         * @param {Item} item
         * @returns {Boolean} @link Item::addMod
         */
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                return item.addMod(this.chooseMod(item));
            }
            
            return false;
        },
        /**
         * item needs to be magic
         * 
         * @param {Item} baseitem
         * @param {Byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.MAGIC) {
                this.applicable_byte |= Augment.APPLICABLE_BYTE.NOT_MAGIC;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Augment.APPLICABLE_BYTE, 
                                 Augment.APPLICABLE_BYTE.SUCCESS, 
                                 "Augment.applicable_byte");
        }
    });
    
    Augment.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_MAGIC: 4
    };
    
    module.exports = Augment;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../concerns/ByteSet":34,"../jquery/jquery_node":39,"./Currency":16,"./Transmute":26}],15:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Alchemy = require('./Alchemy');
    var Scouring = require('./Scouring');
    var Exalted = require('./Exalted');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    
    var ByteSet = require('../concerns/ByteSet');
    /**
     * class Chaos extends Currency
     * 
     * represantation of Chaos Orb
     */
    var Chaos = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Chaos}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Chaos";
        },
        /**
         * adds one random property
         * 
         * @param {Item} item
         * @returns {Boolean} @link Item::addMod
         */
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                // TODO actually considers *_cannot_be_changed?
                // granted via scouring but is this true for ingame alts?
                new Scouring().applyTo(item);
                // no complete scour?
                if (!(new Alchemy(this.available_mods).applyTo(item))) {
                    // TODO correlate count
                    new Exalted(this.available_mods).applyTo(item);
                }
                
                return true;
            }
            
            return false;
        },
        /**
         * item needs to be rare
         * 
         * @param {Item} baseitem
         * @param {Byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.RARE) {
                this.applicable_byte |= Chaos.APPLICABLE_BYTE.NOT_RARE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Chaos.APPLICABLE_BYTE, 
                                 Chaos.APPLICABLE_BYTE.SUCCESS, 
                                 "Chaos.applicable_byte");
        }
    });
    
    Chaos.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_RARE: 4
    };
    
    module.exports = Chaos;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../concerns/ByteSet":34,"./Alchemy":12,"./Currency":16,"./Exalted":18,"./Scouring":24,"./Transmute":26}],16:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var ModGenerator = require('./ModGenerator');
    var Applicable = require('../Applicable');
    var RollableMod = require('../mods/RollableMod');
    var Item = require('../ModContainers/Item');
    var ModGeneratorFactory = require('../ModGenerators/ModGeneratorFactory');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../concerns/ByteSet');
    
    /**
     * abstract class Currency extends ModGenerator
     * 
     * abstract representation of ingame currency which only accepts
     * prefixes, suffixes and implicits
     */
    var Currency = ModGenerator.extend({
        /**
         * 
         * @param {Array} all_mods
         * @param {Function} and_filter additional filter function for $.map
         * @returns {ModGenerator}
         */
        init: function (all_mods, and_filter) {
            if (and_filter === __undefined) {
                // dummy filter
                and_filter = function () { return true; };
            }
            
            this._super(all_mods, RollableMod, function (mod) {
                return mod.SpawnWeight_TagsKeys !== "" && 
                        and_filter(mod);
            });
        },
        /**
         * @abstract
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applyTo: function (mod_container) {
            return false;
        },
        /**
         * maps Mod::applicableTo and Mod::spawnableOn to all available mods
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (item, success) {
            return $.map(this.getAvailableMods(), function (mod) {
                mod.applicableTo(item, success);
                mod.spawnableOn(item);
                
                return mod;
            });
        },
        /**
         * greps Mod::applicableTo and Mod::spawnableOn to all available mods
         * @param {Item} item
         * @param {byte} success
         * @returns {Array}
         */
        mods: function (item, success) {
            return $.grep(this.getAvailableMods(), function (mod) {
                return mod.applicableTo(item, success) && 
                        mod.spawnableOn(item);
            });
        },
        /**
         * currency only applies to items
         * 
         * @param {ModContainer} mod_container
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (mod_container, success) {
            this.resetApplicable();
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (!(mod_container instanceof Item)) {
                this.applicable_byte |= Currency.APPLICABLE_BYTE.NOT_AN_ITEM;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         * sets the class back to unscanned
         * @returns {void}
         */
        resetApplicable: function () {
            this.applicable_byte = Applicable.UNSCANNED;
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, Currency.APPLICABLE_BYTE, Currency.APPLICABLE_BYTE.SUCCESS);
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableCached: function () {
            return !ByteSet.byteBlacklisted(this.applicable_byte, Applicable.SUCCESS);
        },
        name: function () {
            var that = this;
            // grep object
            return $.map(ModGeneratorFactory.GENERATORS, function (props) {
                if (props.klass === that.klass) {
                    return props.name;
                }
                return null;
            })[0] || "AbstractCurrency";
        }
    });
    
    Currency.APPLICABLE_BYTE = {
        // Convention of Applicable
        UNSCANNED: 0,
        SUCCESS: 1,
        // Currency
        NOT_AN_ITEM: 2
    };
    
    module.exports = Currency;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../ModGenerators/ModGeneratorFactory":22,"../concerns/ByteSet":34,"../jquery/jquery_node":39,"../mods/RollableMod":44,"./ModGenerator":21}],17:[function(require,module,exports){
(function (__undefined) {
    var ModGenerator = require('./ModGenerator');
    var Mod = require('../mods/Mod');
    var RollableMod = require('../mods/RollableMod');
    
    var $ = require('../jquery/jquery_node');
    
    /**
     * class EnchantmentBench extends ModGenerator
     * 
     * ingame representation of a enchantment bench
     */
    var Enchantmentbench = ModGenerator.extend({
        init: function (all_mods, and_filter) {
            if (and_filter === __undefined) {
                // dummy filter
                and_filter = function () { return true; };
            }
            
            this._super(all_mods, RollableMod, function (mod) {
                return mod.SpawnWeight_TagsKeys !== "" && 
                        Enchantmentbench.mod_filter(mod);
            });
        },
        applyTo: function (mod_container) {
            return false;
        },
        /**
         * every item is welcome
         * @param {Item} item
         * @returns {Boolean}
         */
        applicableTo: function (item) {
            return true;
        },
        applicableByteHuman: function () {
            return {
                strings: [],
                bits: []
            };
        },
        name: function () {
            return 'Enchantmentbench';
        },
        mods: function (baseitem, success) {
            return $.grep(this.getAvailableMods(), function (mod) {
                return mod.applicableTo(baseitem, success) && 
                        mod.spawnableOn(baseitem);
            });
        },
        map: function (baseitem, success) {
            return $.map(this.getAvailableMods(), function (mod) {
                mod.applicableTo(baseitem, success);
                mod.spawnableOn(baseitem);
                
                return mod;
            });
        }
    });
    
    Enchantmentbench.mod_filter = function (mod_props) {
        // talisman wildcard
        return [Mod.MOD_TYPE.ENCHANTMENT].indexOf(+mod_props.GenerationType) !== -1;
    };
    
    module.exports = Enchantmentbench;
}).call(this);
},{"../jquery/jquery_node":39,"../mods/Mod":42,"../mods/RollableMod":44,"./ModGenerator":21}],18:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    
    var ByteSet = require('../concerns/ByteSet');
    /**
     * class Exalted extends Currency
     * 
     * ingame representation of Exalted orb
     */
    var Exalted = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Exalted}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Exalted";
        },
        /**
         * adds one random property to an item
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) { 
            if (this.applicableTo(item)) {
                return item.addMod(this.chooseMod(item));
            }
            return false;
        },
        /**
         * only applicable to rare items
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.RARE) {
                this.applicable_byte |= Exalted.APPLICABLE_BYTE.NOT_RARE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Exalted.APPLICABLE_BYTE, 
                                 Exalted.APPLICABLE_BYTE.SUCCESS, 
                                 "Exalted.applicable_byte");
        }
    });
    
    Exalted.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_RARE: 4
    };
    
    module.exports = Exalted;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../concerns/ByteSet":34,"./Currency":16,"./Transmute":26}],19:[function(require,module,exports){
(function (__undefined) {
    var ModGenerator = require('./ModGenerator');
    var Transmute = require('./Transmute');
    var Vaal = require('./Vaal');
    var Talisman = require('./Talisman');
    var Item = require('../ModContainers/Item');
    var Mod = require('../mods/Mod');
    var ApplicableMod = require('../mods/ApplicableMod');
    var RollableMod = require('../mods/RollableMod');
    var MasterMod = require('../mods/MasterMod');
    var Spawnable = require('../Spawnable');
    
    /**
     * class ItemShowcase extends ModGenerator
     * 
     * Masterbench/Currency hybrid
     */
    var ItemShowcase = ModGenerator.extend({
        /**
         * 
         * @param {Array} all_mods
         * @returns {ItemShowcase}
         */
        init: function (all_mods) {
            var mods = $.map(all_mods, function (mod) {
                // transmute/vaal mods
                if (!Transmute.mod_filter(mod) && 
                        !Vaal.mod_filter(mod) &&
                        !Talisman.mod_filter(mod)) {
                    return null;
                }
                
                if (+mod.GenerationType === Mod.MOD_TYPE.TALISMAN) {
                    return new ApplicableMod(mod);
                }
                
                if (+mod.Domain === Mod.DOMAIN.MASTER) {
                    // mastermod? => look for craftingbench
                    var craftingbenchoption = $.map(MasterMod.craftingbenchoptions, function (option) {
                        if (+option.ModsKey === +mod.Rows) {
                            return option;
                        }
                        return null;
                    })[0];
                    
                    if (!craftingbenchoption) {
                        // most likely legacy
                        //console.log("could not find craftingbenchoption for ", +mod['Rows'], mod);
                        return null;
                    }
                          
                    return new MasterMod(mod, craftingbenchoption);
                }
                
                // spawnable?
                if (mod.SpawnWeight_TagsKeys !== "") {
                    return new RollableMod(mod);
                }
                
                return null;
            });
            
            this._super(mods, ApplicableMod);
            
            //console.log(this.getAvailableMods());
        },
        /**
         * only abstract showcase, not for actual usage
         * 
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applyTo: function (mod_container) {
            return false;
        },
        /**
         * maps mod::applicableTo and (if implemented) mod::spawnableOn 
         * if we have all the space for mods we need
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (baseitem, success) {
            // simulate showcase
            var old_rarity = baseitem.rarity;
            baseitem.rarity = Item.RARITY.SHOWCASE;
            
            var mods = $.map(this.getAvailableMods(), function (mod) {
                mod.applicableTo(baseitem, success);
                
                if (Spawnable.implementedBy(mod)) {
                    mod.spawnableOn(baseitem, success);
                }
                
                // vaals replace so we dont care about full or not
                if (mod.isType("vaal") && mod.applicable_byte & ApplicableMod.APPLICABLE_BYTE.DOMAIN_FULL) {
                    mod.applicable_byte ^= ApplicableMod.APPLICABLE_BYTE.DOMAIN_FULL;
                }
                
                return mod;
            });
            
            baseitem.rarity = old_rarity;
            return mods;
        },
        /**
         * greps mod::applicableTo and (if implemented) mod::spawnableOn 
         * if we have all the space for mods we need
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Array}
         */
        mods: function (baseitem, success) {
            // simulate showcase
            var old_rarity = baseitem.rarity;
            baseitem.rarity = Item.RARITY.SHOWCASE;
            
            var mods = $.map(this.getAvailableMods(), function (mod) {
                if (mod.applicableTo(baseitem, success) && 
                        (!Spawnable.implementedBy(mod) || mod.spawnableOn(baseitem))) {
                    // vaals replace so we dont care about full or not
                    if (mod.isType("vaal") && mod.applicable_byte & ApplicableMod.APPLICABLE_BYTE.DOMAIN_FULL) {
                        mod.applicable_byte ^= ApplicableMod.APPLICABLE_BYTE.DOMAIN_FULL;
                    }
                    
                    return mod;
                }
                return null;
            });
            
            baseitem.rarity = old_rarity;
            return mods;
        },
        name: function () {
            return "Item Showcase";
        }
    });
    
    module.exports = ItemShowcase;
}).call(this);
},{"../ModContainers/Item":9,"../Spawnable":30,"../mods/ApplicableMod":40,"../mods/MasterMod":41,"../mods/Mod":42,"../mods/RollableMod":44,"./ModGenerator":21,"./Talisman":25,"./Transmute":26,"./Vaal":27}],20:[function(require,module,exports){
(function (__undefined) {
    var ModGenerator = require('./ModGenerator');
    var MasterMod = require('../mods/MasterMod');
    var Item = require('../ModContainers/Item');
    
    var $ = require('../jquery/jquery_node');
    
    /**
     * class Masterbench extends ModGenerator
     * 
     * ingame representation of a Craftingbench
     */
    var Masterbench = ModGenerator.extend({
        /**
         * MasterMod.craftingbenchoptions needs to be initialized
         * @constructor
         * @param {Array} all_mods
         * @param {Number} npc_master_key NPCMasterKey column
         * @returns {Masterbench}
         */
        init: function (all_mods, npc_master_key) {
            // all options
            // craftingbenchoptions instanceof {} so we cant use grep
            this.craftingbenchoptions = $.map(MasterMod.craftingbenchoptions, function (option) {
                if (+option.NPCMasterKey === npc_master_key) {
                    return option;
                }
                return null;
            });
            
            // init mods
            /*
             * |mods| >> |craftingbenchoptions| so we loop through
             * mods and grep options instead of looping through options 
             * and grep mod
             */
            var that = this;
            this._super($.map(all_mods, function (mod_props) {
                if (+mod_props.Domain === Mod.DOMAIN.MASTER) {
                    // mastermod? => look for craftingbench
                    var craftingbenchoption = $.grep(that.craftingbenchoptions, function (option) {
                        return +option.ModsKey === +mod_props.Rows;
                    })[0];
                    
                    if (!craftingbenchoption) {
                        // most likely legacy
                        //console.log("could not find craftingbenchoption for ", +mod['Rows'], mod);
                        return null;
                    }
                          
                    return new MasterMod(mod_props, craftingbenchoption);
                }
                
                return null;
            }), MasterMod);
            
            // possible interface between gui and class
            this.chosen_mod = null;
        },
        /**
         * applies a chosen craftingbenchoption
         * 
         * @param {Item} baseitem
         * @param {Number} option_index option_index within this.craftingbenchoptions
         * @returns {Boolean}
         */
        applyTo: function (baseitem, option_index) {
            var mod, old_rarity;
            
            // option within options
            var option = this.craftingbenchoptions[option_index];
            if (option === __undefined) {
                return false;
            }
            
            mod = $.grep(this.getAvailableMods(), function (mod) {
                return +mod.getProp("Rows") === +option.ModsKey;
            })[0];
            
            // valid mod?
            if (!(mod instanceof MasterMod)) {
                console.log(mod, "needs to be instanceof MasterMod");
                return false;
            }
            
            // white gets upgraded to blue
            old_rarity = baseitem.rarity;
            if (old_rarity === Item.RARITY.NORMAL) {
                baseitem.rarity = Item.RARITY.MAGIC;
            }
            
            // mod applicable
            if (mod.applicableTo(baseitem)) {
                return baseitem.addMod(mod);
            }
            
            // return to old rarity on failure
            baseitem.rarity = old_rarity;
            
            return false;
        },
        /**
         * every item is welcome
         * @param {Item} item
         * @returns {Boolean}
         */
        applicableTo: function (item) {
            return true;
        },
        applicableByteHuman: function () {
            return {
                strings: [],
                bits: []
            };
        },
        /**
         * greps mod::applicableTo 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Array}
         */
        mods: function (baseitem, success) {
            // simulate blue if white
            var old_rarity = baseitem.rarity;
            if (old_rarity === Item.RARITY.NORMAL) {
                baseitem.rarity = Item.RARITY.MAGIC;
            }
            
            var mods = $.grep(this.getAvailableMods(), function (mod) {
                return mod.applicableTo(baseitem, success);
            });
            
            // reroll
            baseitem.rarity = old_rarity;
            
            return mods;
        },
        /**
         * greps mod::applicableTo
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (baseitem, success) {
            // simulate blue if white
            var old_rarity = baseitem.rarity;
            if (old_rarity === Item.RARITY.NORMAL) {
                baseitem.rarity = Item.RARITY.MAGIC;
            }
            
            var mods = $.map(this.getAvailableMods(), function (mod) {
                mod.applicableTo(baseitem, success);
                return mod;
            });
            
            // reroll
            baseitem.rarity = old_rarity;
            
            return mods;
        },
        name: function () {
            return this.craftingbenchoptions[0].MasterNameShort;
        }
    });
    
    module.exports = Masterbench;
}).call(this);
},{"../ModContainers/Item":9,"../jquery/jquery_node":39,"../mods/MasterMod":41,"./ModGenerator":21}],21:[function(require,module,exports){
(function (__undefined) {
    var Class = require('../Inheritance');
    var Applicable = require('../Applicable');
    
    if ($ === __undefined) {
        var $ = require('../jquery/jquery_node');
    }
    
    /*
     * abstract Class ModGenerator implements Applicable
     */
    var ModGenerator = Class.extend({
        /**
         * 
         * @param {Array[mods]} mod_collection
         * @param {String} mod_klass
         * @param {Function} filter filter for mod_props
         * @returns {ModGenerator}
         */
        init: function (mod_collection, mod_klass, filter) {
            this.uses = Number.POSITIVE_INFINITY;
            
            if (filter === __undefined) {
                // dummy filter
                filter = function () { return true; };
            }
            
            // already filtered?
            if (mod_collection[0] instanceof mod_klass) {
                this.available_mods = mod_collection;
            } else {
                this.available_mods = $.map(mod_collection, function (mod_props) {
                    if (filter(mod_props)) {
                        return new mod_klass(mod_props);
                    }
                    return null;
                });
            }
            
            // Applicable
            this.applicable_byte = Applicable.UNSCANNED;
        },
        /**
         * abstract
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applyTo: function (mod_container) {
            
        },
        /**
         * 
         * @returns {Array[Mod]}
         */
        getAvailableMods: function () {
            return this.available_mods.slice();
        },
        mods: function (mod_container, success) {
            return this.getAvailableMods();
        },
        map: function (mod_container, success) {
            return this.getAvailableMods();
        },
        /**
         * abstract
         * @param {ModContainer} mod_container
         * @returns {Boolean}
         */
        applicableTo: function (mod_container) {
            return false;
        },
        resetApplicable: function () {
            this.applicable_byte = Applicable.UNSCANNED;
        },
        /**
         * abstract
         * @returns {String}
         */
        applicableByteHuman: function () {
            return 'abstract';
        },
        applicableCached: function () {
            return this.applicable_byte;
        },
        chooseMod: function (baseitem) {
            
            var mods = this.mods(baseitem);
           
            // TODO spawnweight
            return mods[Math.floor(Math.random() * (mods.length - 1))];
        },
        name: function () {
            return "AbstractModGenerator";
        }
    }); 
    
    module.exports = ModGenerator;
}).call(this);


},{"../Applicable":2,"../Inheritance":6,"../jquery/jquery_node":39}],22:[function(require,module,exports){
(function (__undefined) {
    var Class = require('../Inheritance');
    var Transmute = require('./Transmute');
    var Augment = require('./Augment');
    var Alteration = require('./Alteration');
    var Scouring = require('./Scouring');
    var Regal = require('./Regal');
    var Alchemy = require('./Alchemy');
    var Chaos = require('./Chaos');
    var Exalted = require('./Exalted');
    var ItemShowcase = require('./ItemShowcase');
    var Enchantmentbench = require('./Enchantmentbench');
    
    var ModGeneratorFactory = Class.extend({});
    
    ModGeneratorFactory.build = function (ident, all_mods) {
        var generator = ModGeneratorFactory.GENERATORS[ident];
        if (!generator) {
            console.log("could not identify ", ident);
            return null;
        }
        return new generator.constructor(all_mods);
    };
    
    ModGeneratorFactory.GENERATORS = {
        TRANSMUTE: {
            klass: "Transmute",
            name: "Orb of Transmutation",
            stats: [
                "Currency",
                "Upgrades a normal item to a magic item",
                "Right click this item then left click a normal item to apply"
            ],
            constructor: Transmute
        },
        AUGMENT: {
            klass: "Augment",
            name: "Orb of Augmentation",
            stats: [
                "Currency",
                "Enchants a magic item with a new random property",
                "Right click this item then left click a normal item to apply"
            ],
            constructor: Augment
        },
        ALTERATION: {
            klass: "Alteration",
            name: "Orb of Alteration",
            stats: [
                "Currency",
                "Reforges a magic item with new random properties",
                "Right click this item then left click a normal item to apply"
            ],
            constructor: Alteration
        },
        SCOURING: {
            klass: "Scouring",
            name: "Orb of Scouring",
            stats: [
                "Currency",
                "Removes all properties from an item",
                "Right click this item then left click a normal item to apply"
            ],
            constructor: Scouring
        },
        REGAL: {
            klass: "Regal",
            name: "Regal Orb",
            stats: [
                "Currency",
                "Upgrades a magic item to a rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ],
            constructor: Regal
        },
        ALCHEMY: {
            klass: "Alchemy",
            name: "Orb of Alchemy",
            stats: [
                "Currency",
                "Upgrades a normal item to rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ],
            constructor: Alchemy
        },
        CHAOS: {
            klass: "Chaos",
            name: "Chaos Orb",
            stats: [
                "Currency",
                "Upgrades a magic item to a rare item",
                "Right click this item then left click a magic item to apply it. Current properties are retained and a new one is added."
            ],
            constructor: Chaos
        },
        EXALTED: {
            klass: "Exalted",
            name: "Exalted Orb",
            stats: [
                "Currency",
                "Enchants a rare item with a new random property",
                "Right click this item then left click a rare item to apply it. Rare items can have up to six random properties."
            ],
            constructor: Exalted
        },
        ITEMSHOWCASE: {
            klass: "ItemShowcase",
            name: "Showcase",
            stats: [
                "All Mods",
                "shows all possible mods"
            ],
            constructor: ItemShowcase
        },
        ENCHANTMENTBENCH: {
            klass: "Enchantmentbench",
            name: "Enchantmentbench",
            stats: [
                "Craftingbench",
                "crafts implicit enchantments"
            ],
            constructor: Enchantmentbench
        }
    };
    
    module.exports = ModGeneratorFactory;
}).call(this);


},{"../Inheritance":6,"./Alchemy":12,"./Alteration":13,"./Augment":14,"./Chaos":15,"./Enchantmentbench":17,"./Exalted":18,"./ItemShowcase":19,"./Regal":23,"./Scouring":24,"./Transmute":26}],23:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Transmute = require('./Transmute');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    
    var ByteSet = require('../concerns/ByteSet');
    /**
     * class Regal extrends @link Currency
     * 
     * ingame representation of Regal Orb
     */
    var Regal = Currency.extend({
        /**
         * @constructor
         * @param {Array} all_mods
         * @returns {Regal}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Regal";
        },
        /**
         * adds one random prop and upgrades to rare
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) {
            if (this.applicableTo(item)) {
                // upgrade to rare
                item.rarity = Item.RARITY.RARE;

                return item.addMod(this.chooseMod(item));
            }
            return false;
        },
        /**
         * maps mod::applicableTo as if it were already rare
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.RARE;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * greps mod::applicableTo as if it were already rare
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        mods: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.RARE;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * only applicable to magics
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.MAGIC) {
                this.applicable_byte |= Regal.APPLICABLE_BYTE.NOT_MAGIC;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Regal.APPLICABLE_BYTE, 
                                 Regal.APPLICABLE_BYTE.SUCCESS, 
                                 "Regal.applicable_byte");
        }
    });
    
    Regal.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_MAGIC: 4
    };
    
    module.exports = Regal;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../concerns/ByteSet":34,"./Currency":16,"./Transmute":26}],24:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Item = require('../ModContainers/Item');
    var MasterMod = require('../mods/MasterMod');
    var Applicable = require('../Applicable');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../concerns/ByteSet');
    /**
     * class Scouring extends @link Currency
     */
    var Scouring = Currency.extend({
        /**
         * no mods need for Scouring. it does the exact opposite of generating mods
         * 
         * @constructor
         * @returns {Scouring}
         */
        init: function () {
            this._super([]);
            this.klass = "Scouring";
        },
        /**
         * applies Orb of Scouring to an item
         * considers locked affixes metamods
         * 
         * @param {Item} item
         * @returns {Boolean} true on success
         */
        applyTo: function (item) { 
            var locked_prefixes, locked_suffixes;
            var remaining_prefixes, remaining_suffixes;
            
            if (this.applicableTo(item)) {
                locked_prefixes = item.inMods(MasterMod.METAMOD.LOCKED_PREFIXES) !== -1;
                locked_suffixes = item.inMods(MasterMod.METAMOD.LOCKED_SUFFIXES) !== -1;
                
                $.each(item.getAffixes(), function (_, mod) {
                     if (mod.isPrefix() && !locked_prefixes) {
                         item.removeMod(mod);
                     } else if (mod.isSuffix() && !locked_suffixes) {
                         item.removeMod(mod);
                     }
                });
                
                // set correct rarity
                remaining_prefixes = item.getPrefixes().length;
                remaining_suffixes = item.getSuffixes().length;
                
                if (remaining_prefixes === 0 && remaining_suffixes === 0) {
                    item.rarity = Item.RARITY.NORMAL;
                } else if (remaining_prefixes > 1 || remaining_suffixes > 1) {
                    item.rarity = Item.RARITY.RARE;
                } else {
                    item.rarity = Item.RARITY.MAGIC;
                }

                return true;
            }
            return false;
        },
        /**
         * checks if normal or unique rarity and returns false
         * 
         * @param {Item} baseitem
         * @param {type} success whitelisted @link Scouring.APPLICABLE_BYTE that is considered a success
         * @returns {Boolean} true on success
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            switch (baseitem.rarity) {
                case Item.RARITY.NORMAL:
                    this.applicable_byte |= Scouring.APPLICABLE_BYTE.ALREADY_WHITE;
                    break;
                case Item.RARITY.UNIQUE:
                    this.applicable_byte |= Scouring.APPLICABLE_BYTE.UNIQUE;
                    break;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Scouring.APPLICABLE_BYTE, 
                                 Scouring.APPLICABLE_BYTE.SUCCESS, 
                                 "Scouring.applicable_byte");
        }
    });
    
    /**
     * failure bits
     */
    Scouring.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        ALREADY_WHITE: 4,
        UNIQUE: 8
    };
    
    module.exports = Scouring;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../concerns/ByteSet":34,"../jquery/jquery_node":39,"../mods/MasterMod":41,"./Currency":16}],25:[function(require,module,exports){
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
},{"../mods/Mod":42,"./ModGenerator":21}],26:[function(require,module,exports){
/* jshint bitwise: false */

(function (__undefined) {
    var Currency = require('./Currency');
    var Item = require('../ModContainers/Item');
    var Applicable = require('../Applicable');
    var Mod = require('../mods/Mod');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../concerns/ByteSet');
    
    /**
     * class Transmute extends Currency
     * 
     * ingame representation of Orb of Transmutation
     */
    var Transmute = Currency.extend({
        /**
         * @constructor
         * @param {type} all_mods
         * @returns {Transmute}
         */
        init: function (all_mods) {
            this._super(all_mods, Transmute.mod_filter);
            this.klass = "Transmute";
        },
        /**
         * adds 1-2 mods
         * @param {Item} item
         * @returns {Boolean}
         */
        applyTo: function (item) {
            if (this.applicableTo(item)) {
                // upgrade to rare
                item.rarity = Item.RARITY.MAGIC;

                item.addMod(this.chooseMod(item));
                if (Math.random() <= 0.5) {
                    item.addMod(this.chooseMod(item));
                }
                
                return true;
            }
            
            return false;
        },
        /**
         * maps mod::applicableTo as if it were already magic
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Array}
         */
        map: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.MAGIC;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * greps mod::applicableTo as if it were already magic
         * @param {type} item
         * @param {type} success
         * @returns {Array}
         */
        mods: function (item, success) {
            // simulate upgrade
            var old_rarity = item.rarity;
            item.rarity = Item.RARITY.MAGIC;
            var mods = this._super(item, success);
            item.rarity = old_rarity;

            return mods;
        },
        /**
         * 
         * @param {Item} baseitem
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (baseitem, success) {
            this._super(baseitem, success);
            // remove SUCCESS byte
            this.applicable_byte &= ~Applicable.SUCCESS;
            
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            if (baseitem.rarity !== Item.RARITY.NORMAL) {
                this.applicable_byte |= Transmute.APPLICABLE_BYTE.NOT_WHITE;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         *
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function () {
            return ByteSet.human(this.applicable_byte, 
                                 Transmute.APPLICABLE_BYTE, 
                                 Transmute.APPLICABLE_BYTE.SUCCESS, 
                                 "Transmute.applicable_byte");
        }
    });
    
    Transmute.APPLICABLE_BYTE = {
        // Currency
        UNSCANNED: 0,
        SUCCESS: 1,
        NOT_AN_ITEM: 2,
        // extended
        NOT_WHITE: 4
    };
    
    Transmute.mod_filter = function (mod_props) {
        // prefix/suffix only
        return [Mod.MOD_TYPE.PREFIX, Mod.MOD_TYPE.SUFFIX].indexOf(+mod_props.GenerationType) !== -1;
    };
    
    module.exports = Transmute;
}).call(this);
},{"../Applicable":2,"../ModContainers/Item":9,"../concerns/ByteSet":34,"../jquery/jquery_node":39,"../mods/Mod":42,"./Currency":16}],27:[function(require,module,exports){
(function (__undefined) {
    var Currency = require('./Currency');
    var Mod = require('../mods/Mod');
    
    /**
     * class Vaal extends Currency
     * 
     * ingame representation of Vaal Orb only regarding implicit corruptions
     */
    var Vaal = Currency.extend({
        /**
         * @constructor
         * @param {type} all_mods
         * @returns {Vaal}
         */
        init: function (all_mods) {
            this._super(all_mods, Vaal.mod_filter);
            this.klass = "Vaal";
        }
    });
    
    Vaal.mod_filter = function (mod_props) {
        // vaal implicits
        return [Mod.MOD_TYPE.VAAL].indexOf(+mod_props.GenerationType) !== -1;
    };
    
    module.exports = Vaal;
}).call(this);
},{"../mods/Mod":42,"./Currency":16}],28:[function(require,module,exports){
/* global Class */

(function (__undefined) {
    var Class = require('./Inheritance');
    
    var Path = Class.extend({
        init: function (path_string) {
            this.path = path_string.split("/");
            
            this.is_absolute = this.path[0] === '';
            if (this.isAbsolute()) {
                this.path.shift();
            }
        },
        getBasename: function () {
            return this.path[this.path.length - 1];
        },
        getDirectories: function () {
            return this.path.slice(0, this.path.length - 1);
        },
        isAbsolute: function () {
            return this.is_absolute;
        },
        nextFile: function () {
            if (this.path[0] !== '') {
                return this.path.shift();
            }
            return this.getBasename();
        }
    });
    
    module.exports = Path;
}).call(this);
},{"./Inheritance":6}],29:[function(require,module,exports){
/* global Class */

(function (__undefined) {
    var Class = require('./Inheritance');
    
    /**
     * Interface Serializeable
     */
    var Serializeable = Class.extend({
        serialize: function () {
            return {
                klass: "",
                args: []
            };
        }
    });
    
    /**
     * @see http://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
     * @param {Object} serialized
     * @returns {ModFactory_L1.ModFactory.deserialize.FactoryFunction}
     */
    Serializeable.deserialize = function (serialized) {
        var constructor = window[serialized.klass];
        var args = [null].concat(serialized.args);
        var factoryFunction = constructor.bind.apply(constructor, args);
        return new factoryFunction();
    };
    
    module.exports = Serializeable;
}).call(this);
},{"./Inheritance":6}],30:[function(require,module,exports){
(function (__undefined) {
    var Class = require('./Inheritance');
    
    /**
     * Interface
     */
    var Spawnable = Class.extend({
        init: function () {
            this.spawnweight_cached = 0;
            this.spawnchance = null;
            this.spawnable_byte = Spawnable.SUCCESS;
        },
        spawnableOn: function (mod_container) {
            
        },
        humanSpawnchance: function (precision) {
        },
        resetSpawnable: function () {
            
        },
        spawnableByteHuman: function () {
            
        },
        spawnableCached: function () {
            
        }
    });
    
    Spawnable.map = function (mod_collection, mod_container) {
        return $.map(mod_collection.slice(), function (mod) {
            if (Spawnable.implementedBy(mod)) {
                mod.spawnableOn(mod_container);
            }
            return mod;
        });
    };
    
    Spawnable.mods = function (mod_collection, mod_container, success) {
        return $.grep(mod_collection.slice(), function (mod) {
            return !Spawnable.implementedBy(mod) || mod.spawnableOn(mod_container, success);
        });
    };
    
    // interface pattern
    Spawnable.implementedBy = function (clazz) {
        return  clazz.spawnableOn !== __undefined;
    };
    
    /**
     * 
     * @param {Array<Spawnable>} spawnables
     * @param {Function} if_cb optional callback to filter mods
     * @returns {float}
     */
    Spawnable.calculateSpawnchance = function (spawnables, if_cb) {
        var sum_spawnweight = 0;
        if (typeof if_cb !== 'function') {
            if_cb  = function () { return true; };
        }
        
        $.each(spawnables, function (_, mod) {
            if (Spawnable.implementedBy(mod) && if_cb(mod)) {
                sum_spawnweight += mod.spawnweight;
            }
        });
        
        return $.map(spawnables, function (mod) {
            if (Spawnable.implementedBy(mod) && mod.spawnweight !== null && if_cb(mod)) {
                mod.spawnchance = mod.spawnweight / sum_spawnweight;
            }
            
            return mod;
        });
    };
    
    // Convention
    Spawnable.UNSCANNED = 0;
    Spawnable.SUCCESS = 1;
    
    module.exports = Spawnable;
}).call(this);
},{"./Inheritance":6}],31:[function(require,module,exports){
(function (__undefined) {
    var GgpkEntry = require('./GgpkEntry');
    var ValueRange = require('./ValueRange');
    require('./concerns/Array');
    
    /**
     * class Stat extends GgpkEntry
     */
    var Stat = GgpkEntry.extend({
        init: function (props) {
            this._super(props);
            this.values = new ValueRange(0, 0);
        },
        t: function (other_stats, localization) {
            if (localization === __undefined) {
                localization = Stat.localization;
            }

            var id = this.getProp("Id");
            if (localization.data[id] === __undefined) {
                console.log("no desc for ", id);
                return id;
            }
            
            var params = this.tParams(other_stats, localization);
            
            return localization.t.apply(localization, [id].concat(params));
        },
        tParams: function (other_stats, localization) {
            var id = this.getProp("Id");
            var params = [this.values.toArray()];
            
            if (!localization.data[id]) {
                return params;
            }
            
            var other_params = localization.data[id].params;
            
            if (other_params !== __undefined && other_params.length > 1) {
                params = $.map(other_params, function (param_id) {
                    var stat = $.grep(other_stats, function (stat) {
                        return param_id === stat.getProp("Id");
                    })[0];
                    
                    if (stat === __undefined) {
                        // TODO maybe 0 will match something? better of with +inf?
                        return [[0, 0]];
                    }

                    return [stat.values.toArray()];
                });
            }
            
            return params;
        },
        valueString: function () {
            return "(" + this.values.toString() + ")";
        }
    });
    
    Stat.localization = null;
    
    module.exports = Stat;
})();
},{"./GgpkEntry":4,"./ValueRange":32,"./concerns/Array":33}],32:[function(require,module,exports){
/* global Class, ValueRange */

(function (__undefined) {
    var Class = require("./Inheritance");
    
    /**
     * class ValueRange
     * 
     * a 2-dimensional array with operations for certain mathematical operations
     * can create recursive structures [(2-4)-(6-8)]
     */
    var ValueRange = Class.extend({
        init: function (min, max) {
            this.min = min;
            this.max = max;
        },
        toArray: function () {
            return [this.min, this.max];
        },
        toFixed: function (precision) {
            // will turn 2.1 into 2.10 
            var min = this.min.toFixed(precision);
            if (!(min instanceof ValueRange)) {
                // but with leading + we will get a number again
                min = +min;
            }
            
            var max = this.max.toFixed(precision);
            if (!(max instanceof ValueRange)) {
                // but with leading + we will get a number again
                max = +max;
            }
            
            return new ValueRange(min, max);
        },
        toString: function (depth) {
            if (this.min.equals(this.max)) {
                return this.min.toString();
            }
            
            if (depth === __undefined) {
                depth = 0;
            }
            
            // signature of number.toString(radix) varies from this method sig 
            var min = this.min;
            if (min instanceof ValueRange) {
                min = min.toString(depth + 1);
            } 
            
            var max = this.max;
            if (max instanceof ValueRange) {
                max = max.toString(depth + 1);
            } 
            
            return (depth > 0 ? "(" : "") + 
                    [min, max].join(depth % 2 ? ValueRange.sepEven : ValueRange.sepOdd) + 
                    (depth > 0 ? ")" : "");
        },
        clone: function () {
            return new ValueRange(this.min, this.max);
        },
        add: function (value) {
            if (value instanceof ValueRange) {
                return this.addValueRange(value);
            }
            return this.addScalar(value);
        },
        addScalar: function (lambda) {
            return new ValueRange(this.min + lambda, this.max + lambda);
        },
        addValueRange: function (value_range) {
            return new ValueRange(value_range.add(this.min), 
                                  value_range.add(this.max));
        },
        equals: function (other_value_range) {
            return other_value_range instanceof ValueRange && 
                    this.min.equals(other_value_range.min) && 
                    this.max.equals(other_value_range.max);
        },
        multiply: function (value) {
            if (value instanceof ValueRange) {
                return this.multiplyValueRange(value);
            }
            return this.multiplyScalar(value);
        },
        multiplyScalar: function (lambda) {
            return new ValueRange(this.min * lambda, this.max * lambda);
        },
        multiplyValueRange: function (value_range) {
            return new ValueRange(value_range.multiply(this.min), 
                                  value_range.multiply(this.max));
        },
        isZero: function () {
            return this.toArray().isZero();
        }
    });
    
    ValueRange.sepOdd = " to ";
    ValueRange.sepEven = "-";
    
    module.exports = ValueRange;
})();
},{"./Inheritance":6}],33:[function(require,module,exports){
(function (__undefined) {
    /**
     * 
     * @returns {Boolean} true if every value in this array equal zero
     */
    Array.prototype.isZero = function () {
        var a = this.valueOf();
        for (var i = 0, length = a.length; i < length; ++i) {
            if (typeof a[i].isZero === 'function') {
                if (!a[i].isZero()) {
                    return false;
                }
            } else if (+a[i] !== 0) {
                return false;
            }
        }
        return true;
    };
    
    /*
    /**
     * @link {http://stackoverflow.com/questions/13486479/how-to-get-an-array-of-unique-values-from-an-array-containing-duplicates-in-java}
     * 
     * @returns {Array.prototype@call;reverse@call;filter@call;reverse}
     *
    Array.prototype.unique = function () {
        return this.reverse().filter(function (e, i, arr) {
            return arr.indexOf(e, i+1) === -1;
        }).reverse();
    };
    
    /**
     * jQuery map equiv
     * @param {type} callbackfn
     * @returns {Array.prototype@call;map@call;filter}
     *
    Array.prototype.$map = function (callbackfn) {
        return this.map(callbackfn).filter(function (value) {
            return value !== null;
        });
    };
    
    /**
     * intersection of two array
     * http://jsfiddle.net/neoswf/aXzWw/
     * 
     * @param {type} a
     * @param {type} b
     * @returns {Array|Array.intersect_safe.result}
     *
    Array.intersect = function (a, b)
    {
      var ai = bi= 0;
      var result = [];

      while( ai < a.length && bi < b.length ){
         if      (a[ai] < b[bi] ){ ai++; }
         else if (a[ai] > b[bi] ){ bi++; }
         else  they're equal *
         {
           result.push(ai);
           ai++;
           bi++;
         }
      }

      return result;
    };
    
    Array.prototype.intersect = function (other_arr) {
        return Array.intersect(this.valueOf(), other_arr);
    };//*/
})();
},{}],34:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var Class = require('../Inheritance');
    var $ = require('../jquery/jquery_node');
    
    // todo if-exists
    var ByteSet = Class.extend({});

    // TODO blacklist instead of ignore
    ByteSet.human = function(byte, byte_set, ignore, localization_path) {
        var strings = [];
        var bits = [];

        $.each(byte_set, function (key, bit) {
            if (byte & bit && !(byte & ignore)) {
                bits.push(bit);
                
                var localized = Object.byString(ByteSet.localization, localization_path + "." + bit);
                strings.push(localized ? localized : key);
            }
        });

        return {
            strings: strings,
            bits: bits
        };
    };
    
    ByteSet.localization = null;
    
    ByteSet.initLocalization = function ($legends) {
        ByteSet.localization = {};
        
        $("ul.legend", $legends).each(function () {
            var $legend = $(this);
            var klass = $legend.data("klass");
            var byte_ident = $legend.data("byte-ident");
            
            if (ByteSet.localization[klass] === __undefined) {
                ByteSet.localization[klass] = {};
            }
            
            ByteSet.localization[klass][byte_ident] = {};
            
            $("li", this).each(function () {
                var $li = $(this);
                ByteSet.localization[klass][byte_ident][$li.data(byte_ident)] = $li.text();
            });
        });
        
        console.log(ByteSet.localization);
    };
    
    // turn of everything blacklisted (byte xor (byte & blacklist) = byte & !blacklist)
    ByteSet.byteBlacklisted = function (byte, blacklist) {
        return byte & ~blacklist;
    };
    
    module.exports = ByteSet;
}).call(this);
},{"../Inheritance":6,"../jquery/jquery_node":39}],35:[function(require,module,exports){
(function (__undefined) {
    Math.rand = function (min, max) {
        // math.random() = [0,1) => max - min  + 1 = [0,1]
        return Math.floor((Math.random() * (max - min + 1)) + min);
    };
})();
},{}],36:[function(require,module,exports){
(function (__undefined) {
    Number.prototype.equals = function (other_number) {
        return typeof other_number === 'number' && 
                this.valueOf() === other_number;
    };
})();
},{}],37:[function(require,module,exports){
(function (__undefined) {
    // http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
    Object.byString = function(o, s) {
        if (s === __undefined) {
            return;
        }
        
        s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
        s = s.replace(/^\./, '');           // strip a leading dot
        var a = s.split('.');
        for (var i = 0, n = a.length; i < n; ++i) {
            var k = a[i];
            if (k in o) {
                o = o[k];
            } else {
                return;
            }
        }
        return o;
    };
    
    /**
     * jQuery map equiv
     * @param {type} callbackfn
     * @returns {Array.prototype@call;map@call;filter}
     *
    Object.prototype.$map = function (callbackfn) {
        return this.map(callbackfn).filter(function (value) {
            return value !== null;
        });
    };
    
    Object.prototype.map = function (callbackfn) {
        var self = this.valueOf();
        
        self.forEach(function (value, key) {
            self[key] = callbackfn(value, key, self);
        });
        
        return self;
    };
    
    if (!$) {
        Object.prototype.forEach = function (callbackfn) {
            for (var key in this) {
                if (!this.hasOwnProperty(key)) {
                    continue;
                }

                /*
                console.log('`value`:', this[key]);
                console.log('`key`:', key);
                console.log('`this`:', this);
                callbackfn(this[key], key, this);
            }
        };
    }//*/
})();
},{}],38:[function(require,module,exports){
(function (__undefined) {
    String.prototype.ucfirst = function () {
        return this.valueOf().replace(/^([a-z])/, function (g) { return g.toUpperCase(); });    
    };
    
    String.prototype.underscoreToHuman = function () {
        return this.valueOf()
                // replace underscore
                .replace(/_(\w)/g, function (g) { return " " + g[1].toUpperCase(); }).ucfirst();
                
    };
})();
},{}],39:[function(require,module,exports){
(function (__undefined) {
    /**
     * 
     * @type StringjQuery utilities so we can run in browser and on server without browserify
     */
    
    var version = "2.2.0";
    
    var arr = [];
    
    var slice = arr.slice;

    var concat = arr.concat;

    var push = arr.push;

    var indexOf = arr.indexOf;

    var class2type = {};

    var toString = class2type.toString;

    var hasOwn = class2type.hasOwnProperty;

    var support = {};
    
    var sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	}
    
    function isArrayLike( obj ) {
            // Support: iOS 8.2 (not reproducible in simulator)
            // `in` check used to prevent JIT error (gh-2145)
            // hasOwn isn't used here due to false negatives
            // regarding Nodelist length in IE
            var length = !!obj && "length" in obj && obj.length,
                    type = jQuery.type( obj );

            if ( type === "function" || jQuery.isWindow( obj ) ) {
                    return false;
            }

            return type === "array" || length === 0 ||
                    typeof length === "number" && length > 0 && ( length - 1 ) in obj;
    }   
    
    var jQuery = {
        // Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isFunction: function( obj ) {
		return jQuery.type( obj ) === "function";
	},

	isArray: Array.isArray,

	isWindow: function( obj ) {
		return obj != null && obj === obj.window;
	},

	isNumeric: function( obj ) {

		// parseFloat NaNs numeric-cast false positives (null|true|false|"")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		// adding 1 corrects loss of precision from parseFloat (#15100)
		var realStringObj = obj && obj.toString();
		return !jQuery.isArray( obj ) && ( realStringObj - parseFloat( realStringObj ) + 1 ) >= 0;
	},

	isPlainObject: function( obj ) {

		// Not plain objects:
		// - Any object or value whose internal [[Class]] property is not "[object Object]"
		// - DOM nodes
		// - window
		if ( jQuery.type( obj ) !== "object" || obj.nodeType || jQuery.isWindow( obj ) ) {
			return false;
		}

		if ( obj.constructor &&
				!hasOwn.call( obj.constructor.prototype, "isPrototypeOf" ) ) {
			return false;
		}

		// If the function hasn't returned already, we're confident that
		// |obj| is a plain object, created by {} or constructed with new Object
		return true;
	},

	isEmptyObject: function( obj ) {
		var name;
		for ( name in obj ) {
			return false;
		}
		return true;
	},

	type: function( obj ) {
		if ( obj == null ) {
			return obj + "";
		}

		// Support: Android<4.0, iOS<6 (functionish RegExp)
		return typeof obj === "object" || typeof obj === "function" ?
			class2type[ toString.call( obj ) ] || "object" :
			typeof obj;
	},

	// Evaluates a script in a global context
	globalEval: function( code ) {
		var script,
			indirect = eval;

		code = jQuery.trim( code );

		if ( code ) {

			// If the code includes a valid, prologue position
			// strict mode pragma, execute code by injecting a
			// script tag into the document.
			if ( code.indexOf( "use strict" ) === 1 ) {
				script = document.createElement( "script" );
				script.text = code;
				document.head.appendChild( script ).parentNode.removeChild( script );
			} else {

				// Otherwise, avoid the DOM node creation, insertion
				// and removal by using an indirect global eval

				indirect( code );
			}
		}
	},

	// Convert dashed to camelCase; used by the css and data modules
	// Support: IE9-11+
	// Microsoft forgot to hump their vendor prefix (#9572)
	camelCase: function( string ) {
		return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
	},

	nodeName: function( elem, name ) {
		return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android<4.1
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var length, value,
			i = 0,
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArrayLike( elems ) ) {
			length = elems.length;
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// Bind a function to a context, optionally partially applying any
	// arguments.
	proxy: function( fn, context ) {
		var tmp, args, proxy;

		if ( typeof context === "string" ) {
			tmp = fn[ context ];
			context = fn;
			fn = tmp;
		}

		// Quick check to determine if target is callable, in the spec
		// this throws a TypeError, but we will just return undefined.
		if ( !jQuery.isFunction( fn ) ) {
			return undefined;
		}

		// Simulated bind
		args = slice.call( arguments, 2 );
		proxy = function() {
			return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
		};

		// Set the guid of unique handler to the same of original handler, so it can be removed
		proxy.guid = fn.guid = fn.guid || jQuery.guid++;

		return proxy;
	},

	now: Date.now,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support,
        unique: function( results ) {
            var elem,
                    duplicates = [],
                    j = 0,
                    i = 0;

            // Unless we *know* we can detect duplicates, assume their presence
            hasDuplicate = !support.detectDuplicates;
            sortInput = !support.sortStable && results.slice( 0 );
            results.sort( sortOrder );

            if ( hasDuplicate ) {
                    while ( (elem = results[i++]) ) {
                            if ( elem === results[ i ] ) {
                                    j = duplicates.push( i );
                            }
                    }
                    while ( j-- ) {
                            results.splice( duplicates[ j ], 1 );
                    }
            }

            // Clear input after sorting to release objects
            // See https://github.com/jquery/sizzle/pull/225
            sortInput = null;

            return results;
        }
    };
    
    var $;
    if (window === __undefined || window.jQuery === __undefined) {
        $ = jQuery;
    } else {
        $ = window.jQuery;
    }
    
    module.exports = $;
}).call(this);
},{}],40:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var Mod = require('./Mod');
    var Applicable = require('../Applicable');
    var META_MODS = require('./meta_mods');
    
    var ByteSet = require('../concerns/ByteSet');
    var $ = require('../jquery/jquery_node');
    
    /**
     * class Applicable extends Mod impliements Applicable, Serializeable
     */
    var ApplicableMod = Mod.extend({
        /**
         * 
         * @param {Object} props for GgpkEntry
         * @returns {undefined}
         */
        init: function (props) {
            this._super(props);
            
            // Applicable
            this.resetApplicable();
        },
        /**
         * applicable logic
         * 
         * @param {Item} item
         * @param {byte} success
         * @returns {Boolean} true if applicable
         */
        applicableTo: function (item, success) {
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            // reset
            this.resetApplicable();
            
            if (!item.inDomainOf(+this.getProp("Domain"))) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.WRONG_DOMAIN;
            } else if (!item.hasRoomFor(this)) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.DOMAIN_FULL;
            }
                       
            if (+this.getProp("Level") > item.item_level) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.LOWER_ILVL;
            }
            
            var correct_groups = $.map(item.mods, function (mod) { 
                return mod.getProp("CorrectGroup");
            });
            
            if (correct_groups.indexOf(this.getProp("CorrectGroup")) !== -1) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.ALREADY_PRESENT;
            } 
            
            if (+this.getProp("Level") > 28 && item.inMods(META_MODS.LLD_MOD) !== -1) {
                this.applicable_byte |= ApplicableMod.APPLICABLE_BYTE.ABOVE_LLD_LEVEL;
            }
            
            if (!this.applicable_byte) {
                this.applicable_byte = Applicable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        /**
         * 
         * @returns {!ByteSet.byteBlacklisted}
         */
        applicableCached: function () {
            return !ByteSet.byteBlacklisted(this.applicable_byte, Applicable.SUCCESS);
        },
        /**
         * 
         * @returns {void}
         */
        resetApplicable: function () {
            this.applicable_byte = Applicable.UNSCANNED;
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte, ApplicableMod.APPLICABLE_BYTE, ApplicableMod.APPLICABLE_BYTE.SUCCESS, "RollableMod.applicable_byte");
        },
        /**
         * 
         * @returns {Object} for Serializeable.deserialize
         */
        serialize: function () {
            return {
                klass: "ApplicableMod",
                args: [this.props]
            };
        },
        name: function () {
            return this.getProp("Name");
        },
        rollableCached: function () {
            return this.applicableCached();
        }
    });
    
    ApplicableMod.APPLICABLE_BYTE = {
        UNSCANNED: 0, // per convention 
        SUCCESS: 1, 
        // Applicable
        DOMAIN_FULL: 2,
        ALREADY_PRESENT: 4,
        WRONG_DOMAIN: 8,
        LOWER_ILVL: 16,
        ABOVE_LLD_LEVEL: 32
    };
    
    module.exports = ApplicableMod;
}).call(this);
},{"../Applicable":2,"../concerns/ByteSet":34,"../jquery/jquery_node":39,"./Mod":42,"./meta_mods":45}],41:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var ApplicableMod = require('./ApplicableMod');
    var Applicable = require('../Applicable');
    var GgpkEntry = require('../GgpkEntry');
    
    var ByteSet = require('../concerns/ByteSet');
    var $ = require('../jquery/jquery_node');
    
    /**
     * class MasterMod extends ApplicableMod
     * 
     * mod from a masterbench
     */
    var MasterMod = ApplicableMod.extend({
        init: function (mod_props, bench_props) {
            this._super(mod_props);

            this.bench = new GgpkEntry(bench_props);
        },
        /**
         * modname with basic stats
         * @returns {String}
         */
        name: function () {
            return this.getProp("Name") + 
                    "(" + this.bench.getProp("MasterNameShort") + " Level: " + this.bench.getProp("MasterLevel") + ")";
        },
        /**
         * applicable logic
         * 
         * @param {Item} item
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        applicableTo: function (item, success) {
            var base_item_classes;
            if (success === __undefined) {
                success = Applicable.SUCCESS;
            } else {
                success |= Applicable.SUCCESS;
            }
            
            this._super(item, success);
            
            base_item_classes = this.bench.valueAsArray("BaseItemClassesKeys");
            if (base_item_classes.length > 0 && base_item_classes.indexOf(+item.entry.getProp("ItemClass")) === -1) {
                this.applicable_byte |= MasterMod.APPLICABLE_BYTE.WRONG_ITEMCLASS;
            }
            
            // grep MasterMods and set failure if we cant multimod
            if ($.grep(item.mods, function (mod) {
                return mod instanceof MasterMod;
            }).length > 0 && item.inMods(MasterMod.METAMOD.MULTIMOD) === -1) {
                this.applicable_byte |= MasterMod.APPLICABLE_BYTE.NO_MULTIMOD;
            }
            
            // remove SUCCESS Bit from super if additional failure bits set
            if ((this.applicable_byte & Applicable.SUCCESS) &&  this.applicable_byte > Applicable.SUCCESS) {
                this.applicable_byte ^= Applicable.SUCCESS;
            }
            
            return !ByteSet.byteBlacklisted(this.applicable_byte, success);
        },
        serialize: function () {
            return {
                klass: "MasterMod",
                args: [this.props, this.bench.props]
            };
        },
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte, MasterMod.APPLICABLE_BYTE, MasterMod.APPLICABLE_BYTE.SUCCESS, "MasterMod.applicable_byte");
        }
    });
    
    MasterMod.APPLICABLE_BYTE = {
        // ApplicableMod
        UNSCANNED: 0, // per convention 
        SUCCESS: 1, 
        DOMAIN_FULL: 2,
        ALREADY_PRESENT: 4,
        WRONG_DOMAIN: 8,
        LOWER_ILVL: 16,
        ABOVE_LLD_LEVEL: 32,
        // MasterMod
        WRONG_ITEMCLASS: 64,
        NO_MULTIMOD: 128
    };
    
    MasterMod.METAMOD = require('./meta_mods');
    
    // table `craftingbenchoptions`
    MasterMod.craftingbenchoptions = null;
    
    module.exports = MasterMod;
}).call(this);
},{"../Applicable":2,"../GgpkEntry":4,"../concerns/ByteSet":34,"../jquery/jquery_node":39,"./ApplicableMod":40,"./meta_mods":45}],42:[function(require,module,exports){
(function (__undefined) {
    require('../concerns/Array');
    
    var GgpkEntry = require('../GgpkEntry');
    var Stat = require('../Stat');
    var ValueRange = require('../ValueRange');
    
    if ($ === __undefined) {
        var $ = require('../jquery/jquery_node');
    }
    
    /**
     * extends GgpkEntry implements Localizeable
     */
    var Mod = GgpkEntry.extend({
        init: function (props) {
            this._super(props);
        },
        isPrefix: function () {
            return this.isType("prefix");
        },
        isSuffix: function () {
            return this.isType("suffix");
        },
        isPremade: function () {
            return this.isType("premade");
        },
        isType: function (type) {
            return +this.getProp("GenerationType") === Mod.MOD_TYPE[type.toUpperCase()];
        },
        isAffix: function () {
            return this.isPrefix() || this.isSuffix();
        },
        implicitCandidate: function () {
            return this.isPremade() 
                    || this.isType("vaal") 
                    || this.isType("enchantment");
        },
        /**
         * @returns {Array<Stat>} all stats from this mod
         */
        statsJoined: function () {
            var that = this;
            return $.map(this.valueAsArray("Stats"), function (row, i) {
                if (row.toString().toLowerCase() === 'null') {
                    // continue
                    return null;
                }
                
                var stat = new Stat(Mod.all_stats[row]);
                stat.values = new ValueRange(+that.getProp("Stat" + (i + 1) + "Min"),
                                             +that.getProp("Stat" + (i + 1) + "Max"));
                
                return stat;
            });
        },
        /**
         * translates the stats
         * @returns {String}
         */
        t: function () {
            var stats = this.statsJoined();
            // TODO maybe check before localizing cause unique on long strings might
            // be inefficient. on the other hand we almost always handle < 10 mods
            return $.unique($.map(stats, function (stat) {
                if (stat.values.isZero()) {
                    return null;
                }
                return stat.t(stats, Mod.localization);
            })).join("\n");
        },
        /**
         * translates the correct group
         * @returns {String}
         */
        correctGroupTranslated: function () {
            var correct_group = this.getProp("CorrectGroup");
            var translated = Mod.correct_group_localization[correct_group];
            
            if (translated === __undefined || translated === "") {
                // DeCamelize
                return correct_group
                        // insert a space before all caps
                        .replace(/([A-Z])/g, ' $1');
            }
            
            return translated;
        },
        /**
         * string identifier of the generation type
         * @returns {String}
         */
        modType: function () {
            var that = this;
            return $.map(Mod.MOD_TYPE, function (mod_type, type_name) {
                if (mod_type === +that.getProp("GenerationType")) {
                    return type_name.toLowerCase();
                }
                
                return null;
            })[0];
        },
        name: function () {
            return this.getProp("Name");
        },
        /**
         * unique id for dom
         * @returns {String}
         */
        domId: function () {
            return Mod.domId(this.getProp("Rows"));
        }
    });
    
    Mod.domId = function (id) {
        return "mod_" + id;
    };
    
    Mod.MOD_TYPE = {
        PREFIX: 1,
        SUFFIX: 2,
        PREMADE: 3,
        NEMESIS: 4,
        VAAL: 5,
        BLOODLINES: 6,
        TORMENT: 7,
        TEMPEST: 8,
        TALISMAN: 9,
        ENCHANTMENT: 10
    };
    
    Mod.DOMAIN = {
        ITEM: 1,
        FLASK: 2,
        MONSTER: 3,
        STRONGBOX: 4,
        MAP: 5,
        STANCE: 9,
        MASTER: 10,
        JEWEL: 11
    };
    
    Mod.localization = null;
    Mod.correct_group_localization = null;
    Mod.all_stats = null;
    
    // table `mods`
    this.mods = null;
    
    module.exports = Mod;
}).call(this);
},{"../GgpkEntry":4,"../Stat":31,"../ValueRange":32,"../concerns/Array":33,"../jquery/jquery_node":39}],43:[function(require,module,exports){
(function (__undefined) {
    var Class = require('../Inheritance');
    var Serializeable = require('../Serializeable');
    
    var ModFactory = Class.extend({});
    
    /**
     * @see http://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
     * @param {Object} serialized
     * @returns {ModFactory_L1.ModFactory.deserialize.FactoryFunction}
     */
    ModFactory.deserialize = Serializeable.deserialize;
    
    module.exports = ModFactory;
}).call(this);
},{"../Inheritance":6,"../Serializeable":29}],44:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var ApplicableMod = require('./ApplicableMod');
    var Spawnable = require('../Spawnable');
    
    var $ = require('../jquery/jquery_node');
    var ByteSet = require('../concerns/ByteSet');
    
    /**
     * class RollableMod extends ApplicableMod impliements Spawnable
     */
    var RollableMod = ApplicableMod.extend({
        /**
         * 
         * @param {Object} props for GgpkEntry
         * @returns {undefined}
         */
        init: function (props) {
            this._super(props);
            
            // Spawnable
            this.resetSpawnable();
            
            this.rollable = RollableMod.UNSCANNED;
        },
        /**
         * 
         * @returns {ByteSet.human}
         */
        applicableByteHuman: function() {
            return ByteSet.human(this.applicable_byte, RollableMod.APPLICABLE_BYTE, RollableMod.APPLICABLE_BYTE.SUCCESS, "RollableMod.applicable_byte");
        },
        /**
         * checks if spawnable and sets the spawnweight
         * 
         * @param {ModContainer} mod_container
         * @param {byte} success whitelist
         * @returns {Boolean}
         */
        spawnableOn: function (mod_container, success) {
            if (success === __undefined) {
                success = Spawnable.SUCCESS;
            } else {
                success |= Spawnable.SUCCESS;
            }
            
            var spawnweight_tags = $(this.valueAsArray("SpawnWeight_TagsKeys")).filter(mod_container.getTags()).toArray();
            // reset
            this.resetSpawnable();
            
            if (spawnweight_tags.length === 0) {
                this.spawnable_byte = RollableMod.SPAWNABLE_BYTE.NO_MATCHING_TAGS;
                return false;
            }

            // first spawnweight_tag to  match any item_tag gets to choose
            // the spawnweight
            this.spawnweight = this.valueAsArray("SpawnWeight_Values")[this.valueAsArray("SpawnWeight_TagsKeys").indexOf(spawnweight_tags[0])];
            
            if (this.spawnweight <= 0) {
                this.spawnweight = 0;
                this.spawnable_byte |= RollableMod.SPAWNABLE_BYTE.SPAWNWEIGHT_ZERO;
            }
            
            if (!this.spawnable_byte) {
                this.spawnable_byte = Spawnable.SUCCESS;         
            }
            
            return !ByteSet.byteBlacklisted(this.spawnable_byte, success);
        },
        /**
         * spawnchance in [%]
         * @param {Number} precision
         * @returns {String}
         */
        humanSpawnchance: function (precision) {
            if (precision === __undefined) {
                precision = 2;
            }
            
            var spawnchance = 0.0;

            // spawnchance is basically zero if its not applicable
            if (this.spawnchance !== null && this.applicableCached()) {
                spawnchance = this.spawnchance;
            }

            return (spawnchance * 100).toFixed(precision) + "%";
        },
        resetSpawnable: function () {
            this.spawnweight = 0;
            this.spawnchance = null;
            this.spawnable_byte = Spawnable.UNSCANNED;
        },
        spawnableByteHuman: function() {
            return ByteSet.human(this.spawnable_byte, RollableMod.SPAWNABLE_BYTE, RollableMod.SPAWNABLE_BYTE.SUCCESS, "RollableMod.spawnable_byte");
        },
        spawnableCached: function () {
            return !ByteSet.byteBlacklisted(this.spawnable_byte, Spawnable.SUCCESS);
        },
        rollableOn: function (mod_container) {
            this.rollable = this.applicableTo(mod_container) && 
                            this.spawnableOn(mod_container) ;
            
            return this.rollable;
        },
        /**
         * 
         * @returns {Object} for Serializeable.deserialize
         */
        serialize: function () {
            return {
                klass: "RollableMod",
                args: [this.props]
            };
        },
        rollableCached: function () {
            return this.spawnableCached() && this.applicableCached();
        }
    });
    
    RollableMod.SPAWNABLE_BYTE = {
        UNSCANNED: 0, // per convention 
        SUCCESS: 1,
        NO_MATCHING_TAGS: 2,
        SPAWNWEIGHT_ZERO: 4
    };
    
    RollableMod.APPLICABLE_BYTE = ApplicableMod.APPLICABLE_BYTE;
    
    RollableMod.UNSCANNED = 0;
    RollableMod.SUCCESS = true;
    
    module.exports = RollableMod;
}).call(this);
},{"../Spawnable":30,"../concerns/ByteSet":34,"../jquery/jquery_node":39,"./ApplicableMod":40}],45:[function(require,module,exports){
/*
 * collection of metamods that affect the crafting process
 */
(function (__undefined) {
    'use strict';
    
    module.exports = {
        LOCKED_PREFIXES: 4341,
        LOCKED_SUFFIXES: 4342,
        NO_ATTACK_MODS: 4343,
        NO_CASTER_MODS: 4344,
        MULTIMOD: 4345,
        LLD_MOD: 4288
    };
}).call(this);
},{}]},{},[1]);
