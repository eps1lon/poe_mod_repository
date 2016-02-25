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
    var NotFoundException   = require('./libs/Exceptions/NotFoundException');
    
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
},{"./libs/DataDependency":3,"./libs/Exceptions/NotFoundException":4,"./libs/Hashbang":6,"./libs/Localization":8,"./libs/ModContainers/Item":10,"./libs/ModGenerators/Masterbench":21,"./libs/ModGenerators/ModGenerator":22,"./libs/ModGenerators/ModGeneratorFactory":23,"./libs/Spawnable":31,"./libs/concerns/Array":34,"./libs/concerns/ByteSet":35,"./libs/concerns/Math":36,"./libs/concerns/Number":37,"./libs/concerns/Object":38,"./libs/concerns/String":39,"./libs/mods/ApplicableMod":41,"./libs/mods/MasterMod":42,"./libs/mods/Mod":43,"./libs/mods/ModFactory":44}],2:[function(require,module,exports){
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
},{"./Inheritance":7}],3:[function(require,module,exports){
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
},{"./Inheritance":7,"./concerns/Array":34}],4:[function(require,module,exports){
(function (__undefined) {
    var Class = require('../Inheritance');
    
    var NotFoundException = Class.extend({
        init: function (msg) {
            this.message  = msg;
        }
    });
    
    module.exports = NotFoundException;
}).call(this);
},{"../Inheritance":7}],5:[function(require,module,exports){
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
},{"./Inheritance":7,"./concerns/Array":34,"./jquery/jquery_node":40}],6:[function(require,module,exports){
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
},{"./Inheritance":7,"./Path":29}],7:[function(require,module,exports){
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
},{}],8:[function(require,module,exports){
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
},{"./Inheritance":7,"./concerns/Array":34,"./concerns/Object":38,"./jquery/jquery_node":40}],9:[function(require,module,exports){
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
},{"./Inheritance":7}],10:[function(require,module,exports){
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
                console.error('mod must be instance of `Mod`');
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


},{"../GgpkEntry":5,"../MetaData":9,"../ValueRange":33,"../jquery/jquery_node":40,"../mods/ApplicableMod":41,"../mods/Mod":43,"./ItemImplicits":11,"./ModContainer":12}],11:[function(require,module,exports){
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
},{"../mods/Mod":43,"./ModContainer":12}],12:[function(require,module,exports){
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
                console.error('mod must be instance of `Mod`');
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
},{"../Inheritance":7,"../jquery/jquery_node":40,"../mods/Mod":43}],13:[function(require,module,exports){
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
        },
        name: function () {
            return "Orb of Alchemy";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"./Currency":17,"./Transmute":27}],14:[function(require,module,exports){
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
        },
        name: function () {
            return "Orb of Alteration";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"./Currency":17,"./Transmute":27}],15:[function(require,module,exports){
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
        },
        name: function () {
            return "Orb of Augmentation";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"./Currency":17,"./Transmute":27}],16:[function(require,module,exports){
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
        },
        name: function () {
            return "Chaos Orb";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"./Alchemy":13,"./Currency":17,"./Exalted":19,"./Scouring":25,"./Transmute":27}],17:[function(require,module,exports){
/* jshint bitwise:false */

(function (__undefined) {
    var ModGenerator = require('./ModGenerator');
    var Applicable = require('../Applicable');
    var RollableMod = require('../mods/RollableMod');
    var Item = require('../ModContainers/Item');
    
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
            return "AbstractCurrency";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"../mods/RollableMod":45,"./ModGenerator":22}],18:[function(require,module,exports){
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
},{"../jquery/jquery_node":40,"../mods/Mod":43,"../mods/RollableMod":45,"./ModGenerator":22}],19:[function(require,module,exports){
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
        },
        name: function () {
            return "Exalted Orb";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"./Currency":17,"./Transmute":27}],20:[function(require,module,exports){
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
},{"../ModContainers/Item":10,"../Spawnable":31,"../mods/ApplicableMod":41,"../mods/MasterMod":42,"../mods/Mod":43,"../mods/RollableMod":45,"./ModGenerator":22,"./Talisman":26,"./Transmute":27,"./Vaal":28}],21:[function(require,module,exports){
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
},{"../ModContainers/Item":10,"../jquery/jquery_node":40,"../mods/MasterMod":42,"./ModGenerator":22}],22:[function(require,module,exports){
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


},{"../Applicable":2,"../Inheritance":7,"../jquery/jquery_node":40}],23:[function(require,module,exports){
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


},{"../Inheritance":7,"./Alchemy":13,"./Alteration":14,"./Augment":15,"./Chaos":16,"./Enchantmentbench":18,"./Exalted":19,"./ItemShowcase":20,"./Regal":24,"./Scouring":25,"./Transmute":27}],24:[function(require,module,exports){
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
        },
        name: function () {
            return "Regal Orb";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"./Currency":17,"./Transmute":27}],25:[function(require,module,exports){
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
        },
        name: function () {
            return "Orb of Scouring";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"../mods/MasterMod":42,"./Currency":17}],26:[function(require,module,exports){
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
},{"../mods/Mod":43,"./ModGenerator":22}],27:[function(require,module,exports){
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
        },
        name: function () {
            return "Orb of Transmutation";
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
},{"../Applicable":2,"../ModContainers/Item":10,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"../mods/Mod":43,"./Currency":17}],28:[function(require,module,exports){
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
        },
        name: function () {
            return "Vaal Orb";
        }
    });
    
    Vaal.mod_filter = function (mod_props) {
        // vaal implicits
        return [Mod.MOD_TYPE.VAAL].indexOf(+mod_props.GenerationType) !== -1;
    };
    
    module.exports = Vaal;
}).call(this);
},{"../mods/Mod":43,"./Currency":17}],29:[function(require,module,exports){
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
},{"./Inheritance":7}],30:[function(require,module,exports){
/* global Class */

(function (__undefined) {
    var Class = require('./Inheritance');
    var $ = require('./jquery/jquery_node');
    
    /**
     * Interface Serializeable
     */
    var Serializeable = Class.extend({
        serialize: function () {
            return {
                klass: "",
                args: [],
                constructor: Class // a Class instance
            };
        }
    });
    
    var serialized_struct = new Serializeable().serialize();
    
    /**
     * @see http://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
     * @param {Object} serialized
     * @returns {ModFactory_L1.ModFactory.deserialize.FactoryFunction}
     */
    Serializeable.deserialize = function (serialized) {
        if (!Serializeable.checkStruct(serialized)) {
            console.error("struct doesnt match interface struct", serialized, serialized_struct);
            
            return null;
        }
        
        var constructor = serialized.constructor;
        var args = [null].concat(serialized.args);
        var factoryFunction = constructor.bind.apply(constructor, args);
        return new factoryFunction();
    };
    
    Serializeable.implementedBy = function (clazz) {
        if (!(clazz instanceof Class) || typeof clazz.serialize !== 'function') {
            return false;
        }
        
        return Serializeable.checkStruct(clazz.serialized());
    };
    
    Serializeable.checkStruct = function (serialized) {
        var implemented_by = true;
        
        // check if each property in the struct has the same type
        $.each(serialized_struct, function (key, value) {
            if (typeof serialized[key] !== typeof value) {
                implemented_by = false;
                return false; // break
            }
        });
        
        return implemented_by;
    };
    
    module.exports = Serializeable;
}).call(this);
},{"./Inheritance":7,"./jquery/jquery_node":40}],31:[function(require,module,exports){
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
},{"./Inheritance":7}],32:[function(require,module,exports){
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
},{"./GgpkEntry":5,"./ValueRange":33,"./concerns/Array":34}],33:[function(require,module,exports){
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
},{"./Inheritance":7}],34:[function(require,module,exports){
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
},{}],35:[function(require,module,exports){
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
},{"../Inheritance":7,"../jquery/jquery_node":40}],36:[function(require,module,exports){
(function (__undefined) {
    Math.rand = function (min, max) {
        // math.random() = [0,1) => max - min  + 1 = [0,1]
        return Math.floor((Math.random() * (max - min + 1)) + min);
    };
})();
},{}],37:[function(require,module,exports){
(function (__undefined) {
    Number.prototype.equals = function (other_number) {
        return typeof other_number === 'number' && 
                this.valueOf() === other_number;
    };
})();
},{}],38:[function(require,module,exports){
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
},{}],39:[function(require,module,exports){
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
},{}],40:[function(require,module,exports){
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
},{}],41:[function(require,module,exports){
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
                args: [this.props],
                constructor: ApplicableMod
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
},{"../Applicable":2,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"./Mod":43,"./meta_mods":46}],42:[function(require,module,exports){
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
                args: [this.props, this.bench.props],
                constructor: MasterMod
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
},{"../Applicable":2,"../GgpkEntry":5,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"./ApplicableMod":41,"./meta_mods":46}],43:[function(require,module,exports){
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
},{"../GgpkEntry":5,"../Stat":32,"../ValueRange":33,"../concerns/Array":34,"../jquery/jquery_node":40}],44:[function(require,module,exports){
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
},{"../Inheritance":7,"../Serializeable":30}],45:[function(require,module,exports){
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
                args: [this.props],
                constructor: RollableMod
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
},{"../Spawnable":31,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"./ApplicableMod":41}],46:[function(require,module,exports){
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
},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9ndWkuanMiLCJqcy9saWJzL0FwcGxpY2FibGUuanMiLCJqcy9saWJzL0RhdGFEZXBlbmRlbmN5LmpzIiwianMvbGlicy9FeGNlcHRpb25zL05vdEZvdW5kRXhjZXB0aW9uLmpzIiwianMvbGlicy9HZ3BrRW50cnkuanMiLCJqcy9saWJzL0hhc2hiYW5nLmpzIiwianMvbGlicy9Jbmhlcml0YW5jZS5qcyIsImpzL2xpYnMvTG9jYWxpemF0aW9uLmpzIiwianMvbGlicy9NZXRhRGF0YS5qcyIsImpzL2xpYnMvTW9kQ29udGFpbmVycy9JdGVtLmpzIiwianMvbGlicy9Nb2RDb250YWluZXJzL0l0ZW1JbXBsaWNpdHMuanMiLCJqcy9saWJzL01vZENvbnRhaW5lcnMvTW9kQ29udGFpbmVyLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0FsY2hlbXkuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvQWx0ZXJhdGlvbi5qcyIsImpzL2xpYnMvTW9kR2VuZXJhdG9ycy9BdWdtZW50LmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0NoYW9zLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0N1cnJlbmN5LmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0VuY2hhbnRtZW50YmVuY2guanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvRXhhbHRlZC5qcyIsImpzL2xpYnMvTW9kR2VuZXJhdG9ycy9JdGVtU2hvd2Nhc2UuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvTWFzdGVyYmVuY2guanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvTW9kR2VuZXJhdG9yLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL01vZEdlbmVyYXRvckZhY3RvcnkuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvUmVnYWwuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvU2NvdXJpbmcuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvVGFsaXNtYW4uanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvVHJhbnNtdXRlLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL1ZhYWwuanMiLCJqcy9saWJzL1BhdGguanMiLCJqcy9saWJzL1NlcmlhbGl6ZWFibGUuanMiLCJqcy9saWJzL1NwYXduYWJsZS5qcyIsImpzL2xpYnMvU3RhdC5qcyIsImpzL2xpYnMvVmFsdWVSYW5nZS5qcyIsImpzL2xpYnMvY29uY2VybnMvQXJyYXkuanMiLCJqcy9saWJzL2NvbmNlcm5zL0J5dGVTZXQuanMiLCJqcy9saWJzL2NvbmNlcm5zL01hdGguanMiLCJqcy9saWJzL2NvbmNlcm5zL051bWJlci5qcyIsImpzL2xpYnMvY29uY2VybnMvT2JqZWN0LmpzIiwianMvbGlicy9jb25jZXJucy9TdHJpbmcuanMiLCJqcy9saWJzL2pxdWVyeS9qcXVlcnlfbm9kZS5qcyIsImpzL2xpYnMvbW9kcy9BcHBsaWNhYmxlTW9kLmpzIiwianMvbGlicy9tb2RzL01hc3Rlck1vZC5qcyIsImpzL2xpYnMvbW9kcy9Nb2QuanMiLCJqcy9saWJzL21vZHMvTW9kRmFjdG9yeS5qcyIsImpzL2xpYnMvbW9kcy9Sb2xsYWJsZU1vZC5qcyIsImpzL2xpYnMvbW9kcy9tZXRhX21vZHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzd6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1VkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG4vKiFcclxuICogUG9FIE1vZCBSZXBvc2l0b3J5XHJcbiAqIEJ5IFNlYmFzdGlhbiBTaWxiZXJtYW5uXHJcbiAqIE1JVCBMaWNlbnNlZC5cclxuICovXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIGlmICh3aW5kb3cgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIm5lZWQgd2luZG93IGNvbnRleHRcIik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvL25vZGVcclxuICAgIHZhciBNb2RHZW5lcmF0b3JGYWN0b3J5ID0gcmVxdWlyZSgnLi9saWJzL01vZEdlbmVyYXRvcnMvTW9kR2VuZXJhdG9yRmFjdG9yeScpO1xyXG4gICAgdmFyIE1vZEdlbmVyYXRvciAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvTW9kR2VuZXJhdG9ycy9Nb2RHZW5lcmF0b3InKTtcclxuICAgIHZhciBNYXN0ZXJiZW5jaCAgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL01vZEdlbmVyYXRvcnMvTWFzdGVyYmVuY2gnKTtcclxuICAgIHZhciBJdGVtICAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgdmFyIE1vZCAgICAgICAgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvbW9kcy9Nb2QnKTtcclxuICAgIHZhciBNb2RGYWN0b3J5ICAgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL21vZHMvTW9kRmFjdG9yeScpO1xyXG4gICAgdmFyIEFwcGxpY2FibGVNb2QgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvbW9kcy9BcHBsaWNhYmxlTW9kJyk7XHJcbiAgICB2YXIgTWFzdGVyTW9kICAgICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9tb2RzL01hc3Rlck1vZCcpO1xyXG4gICAgdmFyIFNwYXduYWJsZSAgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvU3Bhd25hYmxlJyk7XHJcbiAgICB2YXIgRGF0YURlcGVuZGVuY3kgICAgICA9IHJlcXVpcmUoJy4vbGlicy9EYXRhRGVwZW5kZW5jeScpO1xyXG4gICAgdmFyIExvY2FsaXphdGlvbiAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvTG9jYWxpemF0aW9uJyk7XHJcbiAgICB2YXIgSGFzaGJhbmcgICAgICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9IYXNoYmFuZycpO1xyXG4gICAgdmFyIEJ5dGVTZXQgICAgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgdmFyIE5vdEZvdW5kRXhjZXB0aW9uICAgPSByZXF1aXJlKCcuL2xpYnMvRXhjZXB0aW9ucy9Ob3RGb3VuZEV4Y2VwdGlvbicpO1xyXG4gICAgXHJcbiAgICByZXF1aXJlKCcuL2xpYnMvY29uY2VybnMvQXJyYXknKTtcclxuICAgIHJlcXVpcmUoJy4vbGlicy9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICByZXF1aXJlKCcuL2xpYnMvY29uY2VybnMvTWF0aCcpO1xyXG4gICAgcmVxdWlyZSgnLi9saWJzL2NvbmNlcm5zL051bWJlcicpO1xyXG4gICAgcmVxdWlyZSgnLi9saWJzL2NvbmNlcm5zL09iamVjdCcpO1xyXG4gICAgcmVxdWlyZSgnLi9saWJzL2NvbmNlcm5zL1N0cmluZycpO1xyXG4gICAgXHJcbiAgICAvLyBcInRhYmxlc1wiXHJcbiAgICB2YXIgbW9kcyA9IFtdLFxyXG4gICAgICAgIHRhZ3MgPSBbXSxcclxuICAgICAgICBiYXNlaXRlbXR5cGVzID0gW10sXHJcbiAgICAgICAgc3RhdHMgPSBbXTtcclxuICAgIFxyXG4gICAgdmFyIFRBR1MgPSB7fTtcclxuICAgIFxyXG4gICAgLy8gdGVtcGxhdGUgbWV0aG9kc1xyXG4gICAgdmFyIGNyZWF0ZV9mcm9tX3RlbXBsYXRlID0gZnVuY3Rpb24gKHNlbGVjdG9yLCBjb250ZXh0KSB7XHJcbiAgICAgICAgaWYgKGNvbnRleHQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICBzZWxlY3RvciA9IGNvbnRleHQuc2VsZWN0b3IgKyBcIiBcIiArIHNlbGVjdG9yO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gJChzZWxlY3RvciArIFwiLnRlbXBsYXRlXCIpLmNsb25lKHRydWUpLnJlbW92ZUNsYXNzKFwidGVtcGxhdGVcIik7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBhc3NlcnQgYmFzZWl0ZW0gdHlwZW9mIEJhc2VJdGVtXHJcbiAgICB2YXIgZGlzcGxheV9iYXNlaXRlbSA9IGZ1bmN0aW9uIChiYXNlaXRlbSwgc2VsZWN0b3IpIHtcclxuICAgICAgICAvLyBhc3NlcnQgYmFzZWl0ZW0gdHlwZW9mIEJhc2VJdGVtXHJcbiAgICAgICAgLy8gcmVtb3ZlIG9sZCBpdGVtYm94XHJcbiAgICAgICAgJChzZWxlY3RvcikuZW1wdHkoKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIShiYXNlaXRlbSBpbnN0YW5jZW9mIEl0ZW0pKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyICRpdGVtYm94ID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCIuaXRlbWJveFwiKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyByYXJpdHlcclxuICAgICAgICB2YXIgcmFyaXR5X2lkZW50ID0gYmFzZWl0ZW0ucmFyaXR5SWRlbnQoKTtcclxuICAgICAgICAkaXRlbWJveC5hZGRDbGFzcyhyYXJpdHlfaWRlbnQpO1xyXG4gICAgICAgICQoXCIjaXRlbV9yYXJpdGllcyBvcHRpb25bdmFsdWU9J1wiICsgcmFyaXR5X2lkZW50LnRvVXBwZXJDYXNlKCkgKyBcIiddXCIpLnByb3AoXCJzZWxlY3RlZFwiLCB0cnVlKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgJHN0YXRzZ3JvdXBfdGVtcGxhdGUgPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcIi5pdGVtYm94LXN0YXRzZ3JvdXBcIiwgJGl0ZW1ib3gpO1xyXG4gICAgICAgIHZhciAkc3RhdHNncm91cCA9ICRzdGF0c2dyb3VwX3RlbXBsYXRlLmNsb25lKHRydWUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIG5hbWVcclxuICAgICAgICAkKFwiLml0ZW1ib3hoZWFkZXIgLml0ZW1OYW1lXCIsICRpdGVtYm94KS50ZXh0KGJhc2VpdGVtLml0ZW1OYW1lKCkpO1xyXG4gICAgICAgICQoXCIuaXRlbWJveGhlYWRlciAuYmFzZU5hbWVcIiwgJGl0ZW1ib3gpLnRleHQoYmFzZWl0ZW0uYmFzZU5hbWUoKSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gaXRlbV9jbGFzc1xyXG4gICAgICAgICRzdGF0c2dyb3VwLmFkZENsYXNzKFwibWV0YV9kYXRhXCIpO1xyXG4gICAgICAgICRzdGF0c2dyb3VwLmFwcGVuZChiYXNlaXRlbS5pdGVtY2xhc3NJZGVudCgpLnRvTG93ZXJDYXNlKCkudWNmaXJzdCgpKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyB0YWdzXHJcbiAgICAgICAgJHN0YXRzZ3JvdXAuYXBwZW5kKFwiPGJyPlwiLCAkLm1hcChiYXNlaXRlbS5nZXRUYWdzV2l0aFByb3BzKHRhZ3MpLCBmdW5jdGlvbiAocHJvcHMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHByb3BzLklkLnVuZGVyc2NvcmVUb0h1bWFuKCk7XHJcbiAgICAgICAgfSkuam9pbihcIiwgXCIpKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBzZXBcclxuICAgICAgICAkKFwiLml0ZW1ib3gtc3RhdHNcIiwgJGl0ZW1ib3gpLmFwcGVuZCgkc3RhdHNncm91cCk7XHJcbiAgICAgICAgJHN0YXRzZ3JvdXAgPSAkc3RhdHNncm91cF90ZW1wbGF0ZS5jbG9uZSh0cnVlKTtcclxuICAgICAgICAkc3RhdHNncm91cC5hZGRDbGFzcyhcImxvY2FsU3RhdHNcIik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gc3RhdHNcclxuICAgICAgICAkLmVhY2goYmFzZWl0ZW0ubG9jYWxTdGF0cygpLCBmdW5jdGlvbiAoc3RhdF9kZXNjLCB2YWx1ZSkge1xyXG4gICAgICAgICAgICAkc3RhdHNncm91cC5hcHBlbmQoXCI8YnI+XCIsIHN0YXRfZGVzYywgXCI6IFwiLCBcIjxzcGFuIGNsYXNzPSd0ZXh0LXZhbHVlJz5cIiArIHZhbHVlICsgXCI8L3NwYW4+XCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHNlcFxyXG4gICAgICAgIGlmICgkLnRyaW0oJHN0YXRzZ3JvdXAudGV4dCgpKS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgJChcIi5pdGVtYm94LXN0YXRzXCIsICRpdGVtYm94KS5hcHBlbmQoJHN0YXRzZ3JvdXApO1xyXG4gICAgICAgIH1cclxuICAgICAgICAkc3RhdHNncm91cCA9ICRzdGF0c2dyb3VwX3RlbXBsYXRlLmNsb25lKHRydWUpO1xyXG4gICAgICAgICRzdGF0c2dyb3VwLmFkZENsYXNzKFwicmVxdWlyZW1lbnRzXCIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFJlcXVpcmVtZW50c1xyXG4gICAgICAgICRzdGF0c2dyb3VwLmFwcGVuZChcIlJlcXVpcmVzIFwiLCAkLm1hcChiYXNlaXRlbS5yZXF1aXJlbWVudHMoKSwgZnVuY3Rpb24gKHJlcXVpcmVtZW50LCBrZXkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGtleSArIFwiIDxzcGFuIGNsYXNzPSd0ZXh0LXZhbHVlJz5cIiArIHJlcXVpcmVtZW50ICsgXCI8L3NwYW4+XCI7XHJcbiAgICAgICAgfSkuam9pbihcIiwgXCIpLCBcIjxicj5cIik7XHJcbiAgICAgICAgLy8gaWx2bFxyXG4gICAgICAgICRzdGF0c2dyb3VwLmFwcGVuZChjcmVhdGVfZnJvbV90ZW1wbGF0ZShcIi5pbHZsXCIsICRpdGVtYm94KS52YWwoYmFzZWl0ZW0uaXRlbV9sZXZlbCkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQuZWFjaChbXCJpbXBsaWNpdHNcIiwgXCJhZmZpeGVzXCJdLCBmdW5jdGlvbiAoXywgbW9kR2V0dGVyKSB7XHJcbiAgICAgICAgICAgIC8vIHNlcFxyXG4gICAgICAgICAgICBpZiAoJC50cmltKCRzdGF0c2dyb3VwLnRleHQoKSkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAkKFwiLml0ZW1ib3gtc3RhdHNcIiwgJGl0ZW1ib3gpLmFwcGVuZCgkc3RhdHNncm91cCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICRzdGF0c2dyb3VwID0gJHN0YXRzZ3JvdXBfdGVtcGxhdGUuY2xvbmUoKTtcclxuICAgICAgICAgICAgJHN0YXRzZ3JvdXAuYWRkQ2xhc3MobW9kR2V0dGVyKTtcclxuXHJcbiAgICAgICAgICAgIHZhciAkbW9kcyA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwidWwubW9kc1wiLCAkaXRlbWJveCk7XHJcbiAgICAgICAgICAgICRtb2RzLmFkZENsYXNzKG1vZEdldHRlcik7XHJcblxyXG4gICAgICAgICAgICAvLyBhZmZpeGVzXHJcbiAgICAgICAgICAgICQuZWFjaChiYXNlaXRlbVtcImdldFwiICsgbW9kR2V0dGVyLnVjZmlyc3QoKV0oKSwgZnVuY3Rpb24gKGksIG1vZCkge1xyXG4gICAgICAgICAgICAgICAgdmFyICRtb2QgPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcImxpLm1vZFwiLCAkbW9kcyk7XHJcblxyXG4gICAgICAgICAgICAgICAgJG1vZC5kYXRhKFwicHJpbWFyeVwiLCBtb2QuZ2V0UHJvcChcIlJvd3NcIikpO1xyXG4gICAgICAgICAgICAgICAgJG1vZC5hZGRDbGFzcyhcIm1vZC10eXBlLVwiICsgbW9kLm1vZFR5cGUoKSk7XHJcbiAgICAgICAgICAgICAgICAkbW9kLmFkZENsYXNzKG1vZC5zZXJpYWxpemUoKS5rbGFzcyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICQoXCIubmFtZVwiLCAkbW9kKS50ZXh0KG1vZC5uYW1lKCkpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAkLmVhY2gobW9kLnQoKS5zcGxpdChcIlxcblwiKSwgZnVuY3Rpb24gKGosIHN0YXRfdGV4dCkge1xyXG4gICAgICAgICAgICAgICAgICAgICQoXCJ1bC5zdGF0c1wiLCAkbW9kKS5hcHBlbmQoXCI8bGk+XCIgKyBzdGF0X3RleHQgKyBcIjwvbGk+XCIpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgJG1vZC5hcHBlbmRUbygkbW9kcyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgaWYgKCQoXCIuc3RhdHMgbGlcIiwgJG1vZHMpLmxlbmd0aCA+IDAgfHwgZmFsc2UpIHtcclxuICAgICAgICAgICAgICAgICRtb2RzLmFwcGVuZFRvKCRzdGF0c2dyb3VwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBzZXBcclxuICAgICAgICBpZiAoJC50cmltKCRzdGF0c2dyb3VwLnRleHQoKSkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICQoXCIuaXRlbWJveC1zdGF0c1wiLCAkaXRlbWJveCkuYXBwZW5kKCRzdGF0c2dyb3VwKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8kKFwiLml0ZW1ib3gtc3RhdHNcIiwgJGl0ZW1ib3gpLmFwcGVuZCgkc2VwYXJhdG9yX3RlbXBsYXRlLmNsb25lKCkpXHJcbiAgICAgICAgLy8kc3RhdHNncm91cCA9ICRzdGF0c2dyb3VwX3RlbXBsYXRlLmNsb25lKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gYXBwZW5kIG5ldyBvbmVcclxuICAgICAgICByZXR1cm4gJChcIiN1c2VkX2Jhc2VpdGVtXCIpLmFwcGVuZCgkaXRlbWJveCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB2YXIgZGlzcGxheV9hdmFpbGFibGVfbW9kcyA9IGZ1bmN0aW9uIChtb2RfZ2VuZXJhdG9yLCBiYXNlaXRlbSkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKG1vZF9nZW5lcmF0b3IsIFwiQFwiLCBiYXNlaXRlbSwgXCI/XCIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHNob3duIGdyb3Vwc1xyXG4gICAgICAgIHZhciAkY2xpY2tlZF9ncm91cHMgPSAkKFwiI2F2YWlsYWJsZV9tb2RzIHRib2R5LmNsaWNrZWRcIik7XHJcbiAgICAgICAgdmFyIHdhc19leHBhbmRlZCA9ICQoXCJ0YWJsZS5tb2RzXCIpLmhhc0NsYXNzKFwiZXhwYW5kZWRcIik7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAvLyBleHRlbmRzIE1vZEdlbmVyYXRvciBpbXBsZW1lbnRzIEFwcGxpY2FibGVcclxuICAgICAgICBpZiAoIShtb2RfZ2VuZXJhdG9yIGluc3RhbmNlb2YgTW9kR2VuZXJhdG9yKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm1vZF9nZW5lcmF0b3IgbmVlZHMgdG8gYmUgb2YgdHlwZSBNb2RHZW5lcmF0b3JcIik7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghKGJhc2VpdGVtIGluc3RhbmNlb2YgSXRlbSkpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJiYXNlaXRlbSBuZWVkcyB0byBiZSBvZiB0eXBlIEJhc2VJdGVtXCIpO1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGZpbHRlclxyXG4gICAgICAgIHZhciB3aGl0ZWxpc3QgPSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5MT1dFUl9JTFZMXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHwgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuRE9NQUlOX0ZVTExcclxuICAgICAgICAgICAgICAgICAgICAgICAgfCBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5BTFJFQURZX1BSRVNFTlRcclxuICAgICAgICAgICAgICAgICAgICAgICAgfCBNYXN0ZXJNb2QuQVBQTElDQUJMRV9CWVRFLk5PX01VTFRJTU9EXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHwgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuQUJPVkVfTExEX0xFVkVMO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBhcHBsaWNhYmxlX21vZHMgPSBtb2RfZ2VuZXJhdG9yLm1vZHMoYmFzZWl0ZW0sIHdoaXRlbGlzdCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gbW9kIGdyb3Vwc1xyXG4gICAgICAgIHZhciBwcmVmaXhlcyA9IFNwYXduYWJsZS5jYWxjdWxhdGVTcGF3bmNoYW5jZSgkLmdyZXAoYXBwbGljYWJsZV9tb2RzLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2QuaXNQcmVmaXgoKTtcclxuICAgICAgICB9KSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbW9kLmFwcGxpY2FibGVDYWNoZWQoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc3VmZml4ZXMgPSBTcGF3bmFibGUuY2FsY3VsYXRlU3Bhd25jaGFuY2UoJC5ncmVwKGFwcGxpY2FibGVfbW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbW9kLmlzU3VmZml4KCk7XHJcbiAgICAgICAgfSksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1vZC5hcHBsaWNhYmxlQ2FjaGVkKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGltcGxpY2l0cyA9IFNwYXduYWJsZS5jYWxjdWxhdGVTcGF3bmNoYW5jZSgkLmdyZXAoYXBwbGljYWJsZV9tb2RzLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2QuaW1wbGljaXRDYW5kaWRhdGUoKTtcclxuICAgICAgICB9KSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbW9kLmFwcGxpY2FibGVDYWNoZWQoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwiaW1wbGljaXRzXCIsIGltcGxpY2l0cyk7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcInByZWZpeGVzXCIsIHByZWZpeGVzKTtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwic3VmZml4XCIsIHN1ZmZpeGVzKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBkaXNwbGF5IHByZWZpeGVzXHJcbiAgICAgICAgZGlzcGxheV9tb2RfZ3JvdXAocHJlZml4ZXMsICQoXCIjcHJlZml4ZXNcIiksIHRydWUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGRpc3BsYXkgc3VmZml4ZXNcclxuICAgICAgICBkaXNwbGF5X21vZF9ncm91cChzdWZmaXhlcywgJChcIiNzdWZmaXhlc1wiKSwgdHJ1ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZGlzcGxheSBpbXBsaWNpdHMgXHJcbiAgICAgICAgZGlzcGxheV9tb2RfZ3JvdXAoaW1wbGljaXRzLCAkKFwiI2ltcGxpY2l0c1wiKSwgZmFsc2UpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHJlbW92ZSBub3Rfcm9sbGFibGUgY2xhc3MgaWYgcm9sbGFibGVcclxuICAgICAgICAkLmVhY2gocHJlZml4ZXMuY29uY2F0KHN1ZmZpeGVzKSwgZnVuY3Rpb24gKGksIG1vZCkge1xyXG4gICAgICAgICAgICBpZiAobW9kLnJvbGxhYmxlQ2FjaGVkKCkpIHtcclxuICAgICAgICAgICAgICAgICQoXCIjY29ycmVjdC1ncm91cC1cIiArIG1vZC5nZXRQcm9wKFwiQ29ycmVjdEdyb3VwXCIpKS5yZW1vdmVDbGFzcyhcIm5vdF9yb2xsYWJsZVwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHJlc3RvcmUgdG9nZ2xlIGdyb3Vwc1xyXG4gICAgICAgICRjbGlja2VkX2dyb3Vwcy5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJChcIiNcIiArICQodGhpcykuYXR0cihcImlkXCIpKS50cmlnZ2VyKFwiY2xpY2tcIik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gd2FzIGV4cGFuZGVkP1xyXG4gICAgICAgIGlmICh3YXNfZXhwYW5kZWQpIHtcclxuICAgICAgICAgICAgJChcIiNleHBhbmRfbW9kc1wiKS50cmlnZ2VyKFwiY2xpY2tcIik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7QXJyYXlbTW9kXX0gbW9kc1xyXG4gICAgICogQHBhcmFtIHtqUXVlcnl9ICR0YWJsZSB2aXN1YWwgY29udGFpbmVyXHJcbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IGdyb3VwaW5nIHdldGhlciB0byBncm91cCBtb2RzIG9mIGEgZ3JvdXAgaW50byB0Ym9kaWVzXHJcbiAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAqL1xyXG4gICAgdmFyIGRpc3BsYXlfbW9kX2dyb3VwID0gZnVuY3Rpb24gKG1vZHMsICR0YWJsZSwgZ3JvdXBpbmcpIHtcclxuICAgICAgICAvLyBlbXB0eSBtb2RzXHJcbiAgICAgICAgaWYgKGdyb3VwaW5nKSB7XHJcbiAgICAgICAgICAgICQoXCJ0Ym9keTpub3QoLnRlbXBsYXRlKVwiLCAkdGFibGUpLnJlbW92ZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICQoXCIubW9kOm5vdCgudGVtcGxhdGUpXCIsICR0YWJsZSkucmVtb3ZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciAkbW9kX3RlbXBsYXRlID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCIubW9kXCIsICR0YWJsZSk7XHJcblxyXG4gICAgICAgIC8vIGRpc3BsYXkgYWZmaXhlc1xyXG4gICAgICAgICQoXCJjYXB0aW9uIC5jb3VudFwiLCAkdGFibGUpLnRleHQobW9kcy5sZW5ndGgpO1xyXG4gICAgICAgICQuZWFjaChtb2RzLCBmdW5jdGlvbiAoXywgbW9kKSB7XHJcbiAgICAgICAgICAgIHZhciAkbW9kID0gJG1vZF90ZW1wbGF0ZS5jbG9uZSh0cnVlKTtcclxuICAgICAgICAgICAgdmFyIHNlcmlhbGl6ZWQgPSBtb2Quc2VyaWFsaXplKCk7XHJcbiAgICAgICAgICAgIHZhciB0aXRsZSwgY29ycmVjdF9ncm91cCwgJGNvcnJlY3RfZ3JvdXA7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkbW9kLmF0dHIoXCJpZFwiLCBtb2QuZG9tSWQoKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBncm91cGluZ1xyXG4gICAgICAgICAgICBpZiAoZ3JvdXBpbmcpIHtcclxuICAgICAgICAgICAgICAgIGNvcnJlY3RfZ3JvdXAgPSBtb2QuZ2V0UHJvcChcIkNvcnJlY3RHcm91cFwiKTtcclxuICAgICAgICAgICAgICAgICRjb3JyZWN0X2dyb3VwID0gJChcInRib2R5Lm1vZHNbZGF0YS1jb3JyZWN0LWdyb3VwPSdcIiArIGNvcnJlY3RfZ3JvdXAgKyBcIiddXCIsICR0YWJsZSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIG5ldyBncm91cD9cclxuICAgICAgICAgICAgICAgIGlmICghJGNvcnJlY3RfZ3JvdXAubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyICRjb3JyZWN0X2dyb3VwX2hlYWRlciA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwidGJvZHkuY29ycmVjdF9ncm91cFwiLCAkdGFibGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICRjb3JyZWN0X2dyb3VwID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCJ0Ym9keS5tb2RzXCIsICR0YWJsZSkuaGlkZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBtYXliZSBjaGFuZ2UgZG8gZGF0YSgpIGFuZCBmaWx0ZXIoKVxyXG4gICAgICAgICAgICAgICAgICAgICRjb3JyZWN0X2dyb3VwX2hlYWRlci5hdHRyKFwiaWRcIiwgXCJjb3JyZWN0LWdyb3VwLVwiICsgY29ycmVjdF9ncm91cCk7XHJcbiAgICAgICAgICAgICAgICAgICAgJGNvcnJlY3RfZ3JvdXAuYXR0cihcImRhdGEtY29ycmVjdC1ncm91cFwiLCBjb3JyZWN0X2dyb3VwKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgJChcInRoLmNvcnJlY3RfZ3JvdXBcIiwgJGNvcnJlY3RfZ3JvdXBfaGVhZGVyKS50ZXh0KG1vZC5jb3JyZWN0R3JvdXBUcmFuc2xhdGVkKCkucmVwbGFjZSgvXFxuLywgXCIgLyBcIikpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAkdGFibGUuYXBwZW5kKCRjb3JyZWN0X2dyb3VwX2hlYWRlciwgJGNvcnJlY3RfZ3JvdXApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgJGNvcnJlY3RfZ3JvdXAgPSAkKFwidGJvZHlcIiwgJHRhYmxlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZXJyb3JcclxuICAgICAgICAgICAgdmFyIGFwcGxpY2FibGVfYnl0ZV9odW1hbiA9IG1vZC5hcHBsaWNhYmxlQnl0ZUh1bWFuKCk7XHJcbiAgICAgICAgICAgICRtb2QuYXR0cihcImRhdGEtYXBwbGljYWJsZV9ieXRlXCIsIGFwcGxpY2FibGVfYnl0ZV9odW1hbi5iaXRzLmpvaW4oXCItXCIpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBzcGF3bmFibGVfYnl0ZV9odW1hbiA9IHtcclxuICAgICAgICAgICAgICAgIHN0cmluZ3M6IFtdXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIGlmIChTcGF3bmFibGUuaW1wbGVtZW50ZWRCeShtb2QpKSB7XHJcbiAgICAgICAgICAgICAgICBzcGF3bmFibGVfYnl0ZV9odW1hbiA9IG1vZC5zcGF3bmFibGVCeXRlSHVtYW4oKTtcclxuICAgICAgICAgICAgICAgICRtb2QuYXR0cihcImRhdGEtc3Bhd25hYmxlLWJ5dGVcIiwgc3Bhd25hYmxlX2J5dGVfaHVtYW4uYml0cy5qb2luKFwiLVwiKSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIGNoYW5jZVxyXG4gICAgICAgICAgICAgICAgJChcIi5zcGF3bl9jaGFuY2VcIiwgJG1vZCkudGV4dChtb2QuaHVtYW5TcGF3bmNoYW5jZSgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGl0bGUgPSBhcHBsaWNhYmxlX2J5dGVfaHVtYW4uc3RyaW5ncy5jb25jYXQoc3Bhd25hYmxlX2J5dGVfaHVtYW4uc3RyaW5ncykuam9pbihcImAgYW5kIGBcIik7XHJcbiAgICAgICAgICAgIGlmICh0aXRsZSkge1xyXG4gICAgICAgICAgICAgICAgJG1vZC5wcm9wKFwidGl0bGVcIiwgXCJgXCIgKyB0aXRsZSArIFwiYFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gaWx2bFxyXG4gICAgICAgICAgICAkKFwiLmlsdmxcIiwgJG1vZCkudGV4dChtb2QuZ2V0UHJvcChcIkxldmVsXCIpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIG5hbWVcclxuICAgICAgICAgICAgJChcIi5uYW1lXCIsICRtb2QpLnRleHQobW9kLm5hbWUoKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyB2YWx1ZVxyXG4gICAgICAgICAgICAkKFwiLnN0YXRzXCIsICRtb2QpLnRleHQobW9kLnQoKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBzZXJpYWxpemVcclxuICAgICAgICAgICAgJG1vZC5kYXRhKFwibW9kXCIsIHNlcmlhbGl6ZWQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcG9zc2libGU/IFRPRE8gYmV0dGVyIHdheT8gbWF5YmUgc2NhbiBieXRlXHJcbiAgICAgICAgICAgIGlmICh0aXRsZSkge1xyXG4gICAgICAgICAgICAgICAgJChcIi5hZGRfbW9kXCIsICRtb2QpLnJlbW92ZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyB2aXN1YWxcclxuICAgICAgICAgICAgJG1vZC5hZGRDbGFzcyhzZXJpYWxpemVkLmtsYXNzKTtcclxuICAgICAgICAgICAgJG1vZC5hZGRDbGFzcyhtb2QubW9kVHlwZSgpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICRjb3JyZWN0X2dyb3VwLmFwcGVuZCgkbW9kKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBsZXQgdGhlIHBsdWdpbiBrbm93IHRoYXQgd2UgbWFkZSBhIHVwZGF0ZSBcclxuICAgICAgICAkdGFibGUudHJpZ2dlcihcInVwZGF0ZVwiKTsgXHJcbiAgICAgICAgLy8gc29ydCBvbiBpbHZsIGRlc2NcclxuICAgICAgICAkdGFibGUudHJpZ2dlcihcInNvcnRvblwiLFtbWzAsMV1dXSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB2YXIgZGlzcGxheV9tb2RfZ2VuX2FwcGxpY2FiaWxpdHkgPSBmdW5jdGlvbiAoYmFzZWl0ZW0sIGFsbF9tb2RzKSB7XHJcbiAgICAgICAgaWYgKCEoYmFzZWl0ZW0gaW5zdGFuY2VvZiBJdGVtKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgICQoXCJ1bC5jdXJyZW5jaWVzIC5hcHBsaWNhYmxlIGlucHV0Lk1vZEdlbmVyYXRvcjpyYWRpb1wiKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyICR0aGlzID0gJCh0aGlzKTtcclxuICAgICAgICAgICAgdmFyICRhcHBsaWNhYmxlID0gJHRoaXMucGFyZW50cyhcIi5hcHBsaWNhYmxlXCIpO1xyXG4gICAgICAgICAgICB2YXIgbW9kX2dlbmVyYXRvciA9IE1vZEdlbmVyYXRvckZhY3RvcnkuYnVpbGQoJHRoaXMudmFsKCksIGFsbF9tb2RzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICR0aGlzLnByb3AoXCJkaXNhYmxlZFwiLCAhbW9kX2dlbmVyYXRvci5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0pKTtcclxuICAgICAgICAgICAgdmFyIGFwcGxpY2FibGVfYnl0ZSA9IG1vZF9nZW5lcmF0b3IuYXBwbGljYWJsZUJ5dGVIdW1hbigpO1xyXG5cclxuICAgICAgICAgICAgJGFwcGxpY2FibGUuYXR0cihcInRpdGxlXCIsIGFwcGxpY2FibGVfYnl0ZS5zdHJpbmdzLmpvaW4oXCIgYW5kIFwiKSk7XHJcbiAgICAgICAgICAgICRhcHBsaWNhYmxlLmF0dHIoXCJkYXRhLWFwcGxpY2FibGVfYnl0ZVwiLCBhcHBsaWNhYmxlX2J5dGUuYml0cy5qb2luKFwiLVwiKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgLy8gbG9hZCBkYXRhXHJcbiAgICAkLndoZW4oXHJcbiAgICAgICAgbmV3IERhdGFEZXBlbmRlbmN5KFwianMvZGF0YS9tb2RzLmpzb25cIiwgXCIjZGF0YV9sb2FkZXJfbW9kc1wiKS5nZXRKU09OKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIG1vZHMgPSBqc29uO1xyXG4gICAgICAgICAgICBNb2QubW9kcyA9IG1vZHM7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbmV3IERhdGFEZXBlbmRlbmN5KFwianMvZGF0YS90YWdzLmpzb25cIiwgXCIjZGF0YV9sb2FkZXJfdGFnc1wiKS5nZXRKU09OKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIHRhZ3MgPSBqc29uO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJCh0YWdzKS5lYWNoKGZ1bmN0aW9uIChfLCB0YWcpIHtcclxuICAgICAgICAgICAgICAgIFRBR1NbdGFnLklkLnRvVXBwZXJDYXNlKCldID0gK3RhZy5Sb3dzO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KSxcclxuICAgICAgICBuZXcgRGF0YURlcGVuZGVuY3koXCJqcy9kYXRhL2Jhc2VpdGVtdHlwZXMuanNvblwiLCBcIiNkYXRhX2xvYWRlcl9iYXNlaXRlbXR5cGVzXCIpLmdldEpTT04oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgYmFzZWl0ZW10eXBlcyA9IGpzb247XHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbmV3IERhdGFEZXBlbmRlbmN5KFwianMvZGF0YS9zdGF0cy5qc29uXCIsIFwiI2RhdGFfbG9hZGVyX3N0YXRzXCIpLmdldEpTT04oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgc3RhdHMgPSBqc29uO1xyXG4gICAgICAgICAgICBNb2QuYWxsX3N0YXRzID0gc3RhdHM7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbmV3IERhdGFEZXBlbmRlbmN5KFwianMvZGF0YS90cmFuc2xhdGlvbnMvRW5nbGlzaC9zdGF0X2Rlc2NyaXB0aW9ucy5qc29uXCIsIFwiI2RhdGFfbG9hZGVyX3N0YXRfZGVzY1wiKS5nZXRKU09OKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIE1vZC5sb2NhbGl6YXRpb24gPSBuZXcgTG9jYWxpemF0aW9uKGpzb24pO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG5ldyBEYXRhRGVwZW5kZW5jeShcImpzL2RhdGEvbWV0YV9kYXRhLmpzb25cIiwgXCIjZGF0YV9sb2FkZXJfbWV0YV9kYXRhXCIpLmdldEpTT04oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgSXRlbS5tZXRhX2RhdGEgPSBqc29uO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG5ldyBEYXRhRGVwZW5kZW5jeShcImpzL2RhdGEvY3JhZnRpbmdiZW5jaG9wdGlvbnMuanNvblwiLCBcIiNkYXRhX2xvYWRlcl9jcmFmdGluZ2JlbmNob3B0aW9uc1wiKS5nZXRKU09OKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIE1hc3Rlck1vZC5jcmFmdGluZ2JlbmNob3B0aW9ucyA9IGpzb247XHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbmV3IERhdGFEZXBlbmRlbmN5KFwianMvZGF0YS90cmFuc2xhdGlvbnMvRW5nbGlzaC9tb2RfY29ycmVjdF9ncm91cHMuanNvblwiLCBcIiNkYXRhX2xvYWRlcl9tb2RfY29ycmVjdF9ncm91cHNfbG9jXCIpLmdldEpTT04oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgTW9kLmNvcnJlY3RfZ3JvdXBfbG9jYWxpemF0aW9uID0ganNvbjtcclxuICAgICAgICB9KVxyXG4gICAgKS50aGVuKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcImxvYWRlZCBcIiArIG1vZHMubGVuZ3RoICsgXCIgbW9kc1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibG9hZGVkIFwiICsgdGFncy5sZW5ndGggKyBcIiB0YWdzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsb2FkZWQgXCIgKyBiYXNlaXRlbXR5cGVzLmxlbmd0aCArIFwiIGJhc2VpdGVtdHlwZXNcIixcclxuICAgICAgICAgICAgICAgICAgICBcImxvYWRlZCBcIiArIHN0YXRzLmxlbmd0aCArIFwiIHN0YXRzXCIpOyBcclxuXHJcbiAgICAgICAgLy8gcGVyc2lzdGVuY2UgdmFyc1xyXG4gICAgICAgIHZhciBtb2RfZ2VuZXJhdG9yID0gbnVsbDtcclxuICAgICAgICB2YXIgYmFzZWl0ZW0gPSBudWxsO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGl0ZW0gc2Nyb2xscyBmaXhlZFxyXG4gICAgICAgIHZhciBpdGVtX2ZpeGVkX3RvcDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgZ2V0X3NlbGVjdGVkX21vZF9nZW5lcmF0b3IgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciAkbW9kX2dlbmVyYXRvciA9ICQoXCJpbnB1dC5Nb2RHZW5lcmF0b3I6cmFkaW86Y2hlY2tlZFwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICgkbW9kX2dlbmVyYXRvci5oYXNDbGFzcyhcIk1hc3RlcmJlbmNoXCIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE1hc3RlcmJlbmNoKG1vZHMsICskbW9kX2dlbmVyYXRvci5kYXRhKCducGNfbWFzdGVyX2tleScpKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBNb2RHZW5lcmF0b3JGYWN0b3J5LmJ1aWxkKCQoXCJpbnB1dC5Nb2RHZW5lcmF0b3I6cmFkaW86Y2hlY2tlZFwiKS52YWwoKSwgbW9kcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGdldCBsb2NhbGl6YXRpb24gZm9yIGJ5dGVzZXRcclxuICAgICAgICBCeXRlU2V0LmluaXRMb2NhbGl6YXRpb24oJChcIiNsZWdlbmRzXCIpKTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgZ2V0X3NlbGVjdGVkX2Jhc2VpdGVtID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgYmFzZWl0ZW1fa2V5ID0gJChcIiNiYXNlaXRlbXMgb3B0aW9uOnNlbGVjdGVkXCIpLmRhdGEoXCJiYXNlaXRlbV9wcmltYXJ5XCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtX2tleSA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgYmFzZWl0ZW1fcHJvcHMgPSBiYXNlaXRlbXR5cGVzW2Jhc2VpdGVtX2tleV07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW1fcHJvcHMgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNvdWxkIG5vdCBmaW5kXCIsIGJhc2VpdGVtX2tleSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGJhc2VpdGVtID0gbmV3IEl0ZW0oYmFzZWl0ZW1fcHJvcHMpO1xyXG4gICAgICAgICAgICB2YXIgJGlsdmwgPSAkKFwiI3VzZWRfYmFzZWl0ZW0gaW5wdXQuaWx2bDpub3QoLnRlbXBsYXRlKVwiKTtcclxuICAgICAgICAgICAgaWYgKCRpbHZsLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgYmFzZWl0ZW0uaXRlbV9sZXZlbCA9ICskaWx2bC52YWwoKTtcclxuICAgICAgICAgICAgfSBcclxuICAgICAgICAgICAgcmV0dXJuIGJhc2VpdGVtO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZGlzcGxheSBpdGVtX2NsYXNzZXNcclxuICAgICAgICAkLmVhY2goSXRlbS5JVEVNQ0xBU1NFUywgZnVuY3Rpb24gKGlkZW50LCBpdGVtX2NsYXNzKSB7XHJcbiAgICAgICAgICAgIHZhciAkb3B0aW9uID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCIjaXRlbV9jbGFzc2VzIG9wdGlvblwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICRvcHRpb24uYWRkQ2xhc3MoaWRlbnQpO1xyXG4gICAgICAgICAgICAkb3B0aW9uLnRleHQoaWRlbnQpO1xyXG4gICAgICAgICAgICAkb3B0aW9uLmRhdGEoXCJpZGVudFwiLCBpZGVudCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkb3B0aW9uLmFwcGVuZFRvKFwiI2l0ZW1fY2xhc3Nlc1wiKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBjaGFuZ2UgaXRlbV9jbGFzcyBoYW5kbGVcclxuICAgICAgICAkKFwiI2l0ZW1fY2xhc3Nlc1wiKS5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciAkc2VsZWN0ZWQgPSAkKFwib3B0aW9uOnNlbGVjdGVkXCIsIHRoaXMpO1xyXG4gICAgICAgICAgICB2YXIgc3ViX3RhZyA9ICQoXCIjaXRlbV9jbGFzc19zdWJfdGFnXCIpLnZhbCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gc2VsZWN0ZWQgSXRlbUNsYXNzXHJcbiAgICAgICAgICAgIHZhciBpdGVtX2NsYXNzID0gSXRlbS5JVEVNQ0xBU1NFU1skc2VsZWN0ZWQuZGF0YShcImlkZW50XCIpXTtcclxuICAgICAgICAgICAgaWYgKGl0ZW1fY2xhc3MgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gYmFzZWl0ZW1zIHRoYXQgaGF2ZSB0aGlzIEl0ZW1DbGFzc1xyXG4gICAgICAgICAgICAvLyBuZWVkcyBtYXAgaW5zdGVhZCBvZiBncmVwIGJlY2F1c2UgdGFibGUgc3RydWN0dXJlIHByaW1hcnkgPT4gdGFibGUgY29sc1xyXG4gICAgICAgICAgICB2YXIgYmFzZWl0ZW1zID0gJC5tYXAoYmFzZWl0ZW10eXBlcywgZnVuY3Rpb24gKGJhc2VpdGVtdHlwZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKGl0ZW1fY2xhc3MuUFJJTUFSWSA9PT0gK2Jhc2VpdGVtdHlwZS5JdGVtQ2xhc3MgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICYmICghc3ViX3RhZyB8fCBiYXNlaXRlbXR5cGUuVGFnc0tleXMuc3BsaXQoXCIsXCIpLmluZGV4T2Yoc3ViX3RhZykgIT09IC0xKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBiYXNlaXRlbXR5cGU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBlbXB0eSBiYXNlaXRlbXNcclxuICAgICAgICAgICAgJChcIiNiYXNlaXRlbXMgb3B0aW9uOm5vdCgudGVtcGxhdGUpXCIpLnJlbW92ZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZGlzcGxheSBiYXNlaXRlbXNcclxuICAgICAgICAgICAgJC5lYWNoKGJhc2VpdGVtcywgZnVuY3Rpb24gKF8sIGJhc2VpdGVtX3Byb3BzKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgJG9wdGlvbiA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwiI2Jhc2VpdGVtcyBvcHRpb25cIik7XHJcbiAgICAgICAgICAgICAgICAkb3B0aW9uLnRleHQoYmFzZWl0ZW1fcHJvcHMuTmFtZSk7XHJcbiAgICAgICAgICAgICAgICAkb3B0aW9uLmF0dHIoXCJkYXRhLWJhc2VpdGVtX3ByaW1hcnlcIiwgYmFzZWl0ZW1fcHJvcHMucHJpbWFyeSk7XHJcbiAgICAgICAgICAgICAgICAkb3B0aW9uLmF0dHIoXCJkYXRhLW5hbWVcIiwgYmFzZWl0ZW1fcHJvcHMuTmFtZSk7XHJcbiAgICAgICAgICAgICAgICAkb3B0aW9uLmFwcGVuZFRvKFwiI2Jhc2VpdGVtc1wiKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBzZWxlY3QgZmlyc3QgYmFzZWl0ZW1cclxuICAgICAgICAgICAgJChcIiNiYXNlaXRlbXMgb3B0aW9uOm5vdCgudGVtcGxhdGUpOmZpcnN0XCIpLnByb3AoXCJzZWxlY3RlZFwiLCB0cnVlKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGFuZCB0cmlnZ2VyIG9uY2hhbmdlXHJcbiAgICAgICAgICAgICQoXCIjYmFzZWl0ZW1zXCIpLnRyaWdnZXIoXCJjaGFuZ2VcIik7XHJcbiAgICAgICAgfSk7IFxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGNoYW5nZSBiYXNlaXRlbSBoYW5kbGVcclxuICAgICAgICAkKFwiI2Jhc2VpdGVtc1wiKS5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIC8vIHBlcnNpc3RlbmNlXHJcbiAgICAgICAgICAgIGJhc2VpdGVtID0gZ2V0X3NlbGVjdGVkX2Jhc2VpdGVtKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyB1cGRhdGUgZ3VpXHJcbiAgICAgICAgICAgIGRpc3BsYXlfYmFzZWl0ZW0oYmFzZWl0ZW0sIFwiI3VzZWRfYmFzZWl0ZW1cIik7XHJcbiAgICAgICAgICAgIGRpc3BsYXlfYXZhaWxhYmxlX21vZHMobW9kX2dlbmVyYXRvciwgYmFzZWl0ZW0pOyAgXHJcbiAgICAgICAgICAgIGRpc3BsYXlfbW9kX2dlbl9hcHBsaWNhYmlsaXR5KGJhc2VpdGVtLCBtb2RzKTtcclxuICAgICAgICB9KTsgXHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGhhc2hiYW5nID0gbmV3IEhhc2hiYW5nKCk7XHJcbiAgICAgICAgdmFyIGhhc2hiYW5nX2NoYW5nZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIG5leHRfZmlsZTtcclxuICAgICAgICAgICAgdmFyIG1hcHBpbmdzID0ge1xyXG4gICAgICAgICAgICAgICAgcmluZ3M6ICdSSU5HJyxcclxuICAgICAgICAgICAgICAgIGFtdWxldHM6ICdBTVVMRVQnLFxyXG4gICAgICAgICAgICAgICAgYmVsdHM6ICdCRUxUJyxcclxuICAgICAgICAgICAgICAgIGpld2VsczogJ0pFV0VMJyxcclxuICAgICAgICAgICAgICAgIGNsYXdzOiAnQ0xBVycsXHJcbiAgICAgICAgICAgICAgICBkYWdnZXJzOiAnREFHR0VSJyxcclxuICAgICAgICAgICAgICAgIGJvd3M6ICdCT1cnLFxyXG4gICAgICAgICAgICAgICAgcXVpdmVyczogJ1FVSVZFUicsXHJcbiAgICAgICAgICAgICAgICBzdGF2ZXM6ICdTVEFGRicsXHJcbiAgICAgICAgICAgICAgICBzY2VwdHJlczogJ1NDRVBUUkUnLFxyXG4gICAgICAgICAgICAgICAgd2FuZHM6ICdXQU5EJyxcclxuICAgICAgICAgICAgICAgICcxaF9heGVzJzogJ0FYRV8xSCcsXHJcbiAgICAgICAgICAgICAgICAnMmhfYXhlcyc6ICdBWEVfMkgnLFxyXG4gICAgICAgICAgICAgICAgJzFoX21hY2VzJzogJ01BQ0VfMUgnLFxyXG4gICAgICAgICAgICAgICAgJzJoX21hY2VzJzogJ01BQ0VfMkgnLFxyXG4gICAgICAgICAgICAgICAgJzFoX3N3b3Jkcyc6ICdTV09SRF8xSCcsXHJcbiAgICAgICAgICAgICAgICAnMmhfc3dvcmRzJzogJ1NXT1JEXzJIJyxcclxuICAgICAgICAgICAgICAgICdtYXBzJzogJ01BUCcsXHJcbiAgICAgICAgICAgICAgICBhcm1vdXJzOiAnQVJNT1VSJyxcclxuICAgICAgICAgICAgICAgIGdsb3ZlczogJ0dMT1ZFUycsXHJcbiAgICAgICAgICAgICAgICBib290czogJ0JPT1RTJyxcclxuICAgICAgICAgICAgICAgIGhlbG1ldHM6ICdIRUxNRVQnLFxyXG4gICAgICAgICAgICAgICAgc2hpZWxkczogJ1NISUVMRCdcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgdmFyICRiYXNlaXRlbTtcclxuICAgICAgICAgICAgdmFyIHN1Yl90YWcgPSAnJztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGl0ZW1jbGFzc1xyXG4gICAgICAgICAgICBuZXh0X2ZpbGUgPSB0aGlzLmdldFBhdGgoKS5uZXh0RmlsZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG1hcHBpbmdzW25leHRfZmlsZV0pIHtcclxuICAgICAgICAgICAgICAgICQoJyNpdGVtX2NsYXNzZXMgLml0ZW1fY2xhc3MuJyArIG1hcHBpbmdzW25leHRfZmlsZV0pLnByb3AoXCJzZWxlY3RlZFwiLCB0cnVlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICQoJyNpdGVtX2NsYXNzZXMgLml0ZW1fY2xhc3MuUklORycpLnByb3AoXCJzZWxlY3RlZFwiLCB0cnVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKFtcImFybW91cnNcIiwgXCJib290c1wiLCBcImdsb3Zlc1wiLCBcImhlbG1ldHNcIiwgXCJzaGllbGRzXCJdLmluZGV4T2YobmV4dF9maWxlKSAhPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIC8vIHNldCBsaW5rcyB0byBpdGVtX2NsYXNzXHJcbiAgICAgICAgICAgICAgICAkKFwiI3RhZ19zZWxlY3Rvcl9yZXEgYVwiKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgJHRoaXMgPSAkKHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgICAgICR0aGlzLmF0dHIoXCJocmVmXCIsIFwiIyEvXCIgKyBuZXh0X2ZpbGUgKyBcIi9cIiArICR0aGlzLmF0dHIoXCJkYXRhLXN1Yl90YWdcIikpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICQoXCIjdGFnX3NlbGVjdG9yX3JlcVwiKS5zaG93KCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobmV4dF9maWxlID09PSAnbWFwcycpIHtcclxuICAgICAgICAgICAgICAgICQoXCIjdGFnX3NlbGVjdG9yX21hcFwiKS5zaG93KCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAkKFwiLnN1Yl90YWdfc2VsZWN0b3JcIikuaGlkZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBzdWIgZ3JvdXAgb2YgaXRlbWNsYXNzPyBzdHJfYXJtb3VyLCBkZXhfYXJtb3VyIGV0Y1xyXG4gICAgICAgICAgICBuZXh0X2ZpbGUgPSB0aGlzLmdldFBhdGgoKS5uZXh0RmlsZSgpO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIG5leHRfZmlsZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgIC8vIHNlbGVjdCAqIGZyb20gdGFncyB3aGVyZSBJZCA9IG5leHRfZmlsZVxyXG4gICAgICAgICAgICAgICAgc3ViX3RhZyA9ICQubWFwKHRhZ3MsIGZ1bmN0aW9uICh0YWcpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGFnLklkID09PSBuZXh0X2ZpbGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhZztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9KVswXTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gc3ViX3RhZyBmb3VuZFxyXG4gICAgICAgICAgICAgICAgaWYgKHN1Yl90YWcgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Yl90YWcgPSBzdWJfdGFnLnByaW1hcnk7XHJcbiAgICAgICAgICAgICAgICAgICAgJChcIi5zdWJfdGFnX3NlbGVjdG9yXCIpLmhpZGUoKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAvLyBuZXh0IGRpcmVjdG9yeVxyXG4gICAgICAgICAgICAgICAgICAgIG5leHRfZmlsZSA9IHRoaXMuZ2V0UGF0aCgpLm5leHRGaWxlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgJChcIiNpdGVtX2NsYXNzX3N1Yl90YWdcIikudmFsKHN1Yl90YWcpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gbm8gdHJpZ2dlciBpdGVtY2xhc3MgY2hhbmdlXHJcbiAgICAgICAgICAgICQoJyNpdGVtX2NsYXNzZXMnKS50cmlnZ2VyKFwiY2hhbmdlXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gYmFzZWl0ZW1cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBuZXh0X2ZpbGUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICAkYmFzZWl0ZW0gPSAkKFwiI2Jhc2VpdGVtcyBvcHRpb246bm90KC50ZW1wbGF0ZSlbZGF0YS1uYW1lPSdcIiArIG5leHRfZmlsZS5yZXBsYWNlKC9fLywgXCIgXCIpICsgXCInXVwiKTtcclxuICAgICAgICAgICAgICAgIGlmICgkYmFzZWl0ZW0ubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgJGJhc2VpdGVtLnByb3AoXCJzZWxlY3RlZFwiLCB0cnVlKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dF9maWxlID0gdGhpcy5nZXRQYXRoKCkubmV4dEZpbGUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gVE9ETyBjYXRjaCBub3QgZm91bmRcclxuICAgICAgICAgICAgLy8gSGFzaGJhbmcgYmFzaWMgZ3VpIG5hdmlnYXRpb25cclxuICAgICAgICAgICAgaWYgKG5leHRfZmlsZSA9PT0gJ3dpdGhSZWNpcGUnKSB7XHJcbiAgICAgICAgICAgICAgICBuZXh0X2ZpbGUgPSB0aGlzLmdldFBhdGgoKS5uZXh0RmlsZSgpO1xyXG4gICAgICAgICAgICAgICAgc3dpdGNoIChuZXh0X2ZpbGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdub19hdHRhY2tfbW9kcyc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ25vX2Nhc3Rlcl9tb2RzJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbm9fYXR0YWNrX29yX2Nhc3Rlcl9tb2RzJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbGxkX21vZHMnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgTm90Rm91bmRFeGNlcHRpb24oJ3JlY2lwZSBgJyArIG5leHRfZmlsZSArICdgIG5vdCBmb3VuZCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvLyBUT0RPIGRvZXNudCB3b3JrXHJcbiAgICAgICAgaGFzaGJhbmcub25DaGFuZ2UoaGFzaGJhbmdfY2hhbmdlKTtcclxuICAgICAgICBcclxuICAgICAgICBoYXNoYmFuZy53aXRoV2luZG93KHdpbmRvdyk7XHJcbiAgICAgICAgaGFzaGJhbmdfY2hhbmdlLmFwcGx5KGhhc2hiYW5nKTtcclxuICAgICAgICBcclxuICAgICAgICAkKHdpbmRvdykub24oXCJoYXNoY2hhbmdlXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaGFzaGJhbmcud2l0aFdpbmRvdyh3aW5kb3cpO1xyXG4gICAgICAgICAgICBoYXNoYmFuZ19jaGFuZ2UuYXBwbHkoaGFzaGJhbmcpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBjaGFuZ2UgbW9kZ2VuIGhhbmRsZVxyXG4gICAgICAgICQoXCJpbnB1dC5Nb2RHZW5lcmF0b3I6cmFkaW9cIikub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAvLyBwZXJzaXN0ZW5jZVxyXG4gICAgICAgICAgICBtb2RfZ2VuZXJhdG9yID0gZ2V0X3NlbGVjdGVkX21vZF9nZW5lcmF0b3IoKTtcclxuXHJcbiAgICAgICAgICAgIC8vIHVwZGF0ZSBndWlcclxuICAgICAgICAgICAgZGlzcGxheV9hdmFpbGFibGVfbW9kcyhtb2RfZ2VuZXJhdG9yLCBiYXNlaXRlbSk7XHJcbiAgICAgICAgICAgICQoXCIjdXNlX21vZF9nZW4gLm5hbWVcIikudGV4dChtb2RfZ2VuZXJhdG9yLm5hbWUoKSk7XHJcbiAgICAgICAgICAgICQoXCIjdXNlX21vZF9nZW4gLmNyYWZ0aW5nYmVuY2hvcHRpb25cIikuZW1wdHkoKTtcclxuICAgICAgICAgICAgJChcIiN1c2VfbW9kX2dlblwiKS5hdHRyKFwiZGF0YS1hcHBsaWNhYmxlXCIsIFwiXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIGNyYWZ0aW5nYmVuY2hvcHRpb25zXHJcbiAgICAgICAgICAgIHZhciAkY3JhZnRpbmdiZW5jaG9wdGlvbnMgPSAkKFwiI2NyYWZ0aW5nYmVuY2hvcHRpb25zXCIpO1xyXG4gICAgICAgICAgICAkKFwiLmNyYWZ0aW5nYmVuY2hvcHRpb246bm90KC50ZW1wbGF0ZSlcIiwgJGNyYWZ0aW5nYmVuY2hvcHRpb25zKS5yZW1vdmUoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChtb2RfZ2VuZXJhdG9yIGluc3RhbmNlb2YgTWFzdGVyYmVuY2gpIHtcclxuICAgICAgICAgICAgICAgIC8vIGRpc3BsYXkgb3B0aW9uc1xyXG4gICAgICAgICAgICAgICAgJC5lYWNoKG1vZF9nZW5lcmF0b3IuY3JhZnRpbmdiZW5jaG9wdGlvbnMsIGZ1bmN0aW9uIChpLCBjcmFmdGluZ2JlbmNob3B0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gTW9kIGF0bGVhc3QgZGlzcGxheWVkIHNvIHdlIGFsc28gZGlzcGxheSB0aGUgb3B0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCQoXCIjXCIgKyBNb2QuZG9tSWQoY3JhZnRpbmdiZW5jaG9wdGlvbi5Nb2RzS2V5KSkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciAkb3B0aW9uID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCIuY3JhZnRpbmdiZW5jaG9wdGlvblwiLCAkY3JhZnRpbmdiZW5jaG9wdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgJG9wdGlvbi52YWwoaSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICRvcHRpb24udGV4dChjcmFmdGluZ2JlbmNob3B0aW9uLk5hbWUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgJGNyYWZ0aW5nYmVuY2hvcHRpb25zLmFwcGVuZCgkb3B0aW9uKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gZGlzcGxheSBubyBvcHRpb25zIGhpbnRcclxuICAgICAgICAgICAgICAgICQoXCIjbm9fY3JhZnRpbmdiZW5jaG9wdGlvbnNcIikudG9nZ2xlKCQoXCIuY3JhZnRpbmdiZW5jaG9wdGlvbjpub3QoLnRlbXBsYXRlKVwiKS5sZW5ndGggPT09IDApO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBzZWxlY3QgbGFzdCBvcHRpb24gYmVjYXVzZSBvdGhlcndpc2UgYSByZWNlbnRseSBoaWRkZW5cclxuICAgICAgICAgICAgICAgIC8vICNub19jcmFmdGluZ2JlbmNob3B0aW9ucyB3aWxsIHN0aWxsIGJlIHNlbGVjdGVkIGluIGNocm9tZVxyXG4gICAgICAgICAgICAgICAgLy8gYWxzbyBzZWxlY3RpbmcgZmlyc3QgdmlzaWJsZSB5aWVsZHMgdG8gd2VpcmQgaW50ZXJhY3Rpb25zXHJcbiAgICAgICAgICAgICAgICAvLyB3aXRoIGhpZGRlbiBvcHRpb25zIFxyXG4gICAgICAgICAgICAgICAgJChcIm9wdGlvbjpsYXN0XCIsICRjcmFmdGluZ2JlbmNob3B0aW9ucykucHJvcChcInNlbGVjdGVkXCIsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgJGNyYWZ0aW5nYmVuY2hvcHRpb25zLnRyaWdnZXIoXCJjaGFuZ2VcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICQoXCJpbnB1dDpyYWRpby5Nb2RHZW5lcmF0b3JcIikucGFyZW50cyhcIi5hcHBsaWNhYmxlXCIpLnJlbW92ZUNsYXNzKFwic2VsZWN0ZWRcIik7XHJcbiAgICAgICAgICAgIC8vIGFkZCBzZWxlY3RlZCBjbGFzcyB0byAuYXBwbGljYWJsZSBjb250YWluZXJcclxuICAgICAgICAgICAgJChcImlucHV0OnJhZGlvOmNoZWNrZWQuTW9kR2VuZXJhdG9yXCIpLnBhcmVudHMoXCIuYXBwbGljYWJsZVwiKS5hZGRDbGFzcyhcInNlbGVjdGVkXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBjaGFuZ2VkIGNyYWZ0aW5nYmVuY2hvcHRpb24gaGFuZGxlXHJcbiAgICAgICAgJChcIiNjcmFmdGluZ2JlbmNob3B0aW9uc1wiKS5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQoXCIjdXNlX21vZF9nZW4gLmNyYWZ0aW5nYmVuY2hvcHRpb25cIikudGV4dCgkKFwib3B0aW9uOnNlbGVjdGVkXCIsIHRoaXMpLnRleHQoKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gbW9kIGdlbiBoYW5kbGVcclxuICAgICAgICAkKFwiI3VzZV9tb2RfZ2VuXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgYXJncztcclxuICAgICAgICAgICAgdmFyICR0aGlzID0gJCh0aGlzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZF9nZW5lcmF0b3IsIFwiQFwiLCBiYXNlaXRlbSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIShtb2RfZ2VuZXJhdG9yIGluc3RhbmNlb2YgTW9kR2VuZXJhdG9yKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJtb2RfZ2VuZXJhdG9yIG5lZWRzIHRvIGJlIG9mIHR5cGUgTW9kR2VuZXJhdG9yXCIpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIShiYXNlaXRlbSBpbnN0YW5jZW9mIEl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImJhc2VpdGVtIG5lZWRzIHRvIGJlIG9mIHR5cGUgSXRlbVwiKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gYnVpbGQgYXBwbHlUbyBhcmdzXHJcbiAgICAgICAgICAgIGFyZ3MgPSBbYmFzZWl0ZW1dO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gd2UgbmVlZCB0aGUgc2VsZWN0ZWQgY3JhZnRpbmdiZW5jaG9wdGlvblxyXG4gICAgICAgICAgICBpZiAobW9kX2dlbmVyYXRvciBpbnN0YW5jZW9mIE1hc3RlcmJlbmNoKSB7XHJcbiAgICAgICAgICAgICAgICBhcmdzLnB1c2goKyQoXCIjY3JhZnRpbmdiZW5jaG9wdGlvbnMgb3B0aW9uOnNlbGVjdGVkXCIpLnZhbCgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gYXBwbHlcclxuICAgICAgICAgICAgaWYgKG1vZF9nZW5lcmF0b3IuYXBwbHlUby5hcHBseShtb2RfZ2VuZXJhdG9yLCBhcmdzKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gZGlzcGxheVxyXG4gICAgICAgICAgICAgICAgZGlzcGxheV9iYXNlaXRlbShiYXNlaXRlbSwgXCIjdXNlZF9iYXNlaXRlbVwiKTtcclxuICAgICAgICAgICAgICAgIGRpc3BsYXlfYXZhaWxhYmxlX21vZHMobW9kX2dlbmVyYXRvciwgYmFzZWl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgZGlzcGxheV9tb2RfZ2VuX2FwcGxpY2FiaWxpdHkoYmFzZWl0ZW0sIG1vZHMpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAkdGhpcy5hdHRyKFwiZGF0YS1hcHBsaWNhYmxlXCIsIHRydWUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gZmxhc2ggZXJyb3JcclxuICAgICAgICAgICAgICAgICR0aGlzLmF0dHIoXCJkYXRhLWFwcGxpY2FibGVcIiwgZmFsc2UpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBkaXNwbGF5IG1vZCBncm91cFxyXG4gICAgICAgICQoXCIjYXZhaWxhYmxlX21vZHMgdGJvZHkuY29ycmVjdF9ncm91cFwiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJCh0aGlzKS50b2dnbGVDbGFzcyhcImNsaWNrZWRcIikubmV4dCgpLnRvZ2dsZSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGRpc3BsYXkgaW1wbGNpdHNcclxuICAgICAgICAkKFwiI2ltcGxpY2l0cy1jYXB0aW9uXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKHRoaXMpLnRvZ2dsZUNsYXNzKFwiY2xpY2tlZFwiKS5wYXJlbnRzKFwidGFibGVcIikuY2hpbGRyZW4oXCJ0Ym9keVwiKS50b2dnbGUoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBqUXVlcnkgVGFibGVzb3J0ZXIgY29uZmlnXHJcbiAgICAgICAgJChcIiNwcmVmaXhlcywgI3N1ZmZpeGVzLCAjaW1wbGljaXRzXCIpLnRhYmxlc29ydGVyKHtcclxuICAgICAgICAgICAgY3NzSW5mb0Jsb2NrIDogXCJ0YWJsZXNvcnRlci1uby1zb3J0XCJcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBhZGQgbW9kXHJcbiAgICAgICAgJChcIi5hZGRfbW9kXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAvLyBhc3NlcnQgYmFzZWl0ZW0gaW5zdGFuY2VvZiBiYXNlaXRlbVxyXG4gICAgICAgICAgICB2YXIgc2VyaWFsaXplZCA9ICQodGhpcykucGFyZW50cyhcInRyXCIpLmRhdGEoXCJtb2RcIik7XHJcbiAgICAgICAgICAgIHZhciBtb2QgPSBNb2RGYWN0b3J5LmRlc2VyaWFsaXplKHNlcmlhbGl6ZWQpO1xyXG4gICAgICAgICAgICB2YXIgYWRkZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChtb2QgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY291bGQgbm90IGRlc2VyaWFsaXplXCIsIHNlcmlhbGl6ZWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGJhc2VpdGVtLCBcIitcIiwgbW9kKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGFkZGVkID0gYmFzZWl0ZW0uYWRkTW9kKG1vZCk7XHJcbiAgICAgICAgICAgIC8vIHRyeSBhdCBsZWFzdCBvbmUgdGltZSB0byBtYWtlIG1vcmUgcm9vbSBmb3IgbW9kc1xyXG4gICAgICAgICAgICBpZiAoIWFkZGVkICYmIGJhc2VpdGVtLnVwZ3JhZGVSYXJpdHkoKSkge1xyXG4gICAgICAgICAgICAgICAgYWRkZWQgPSBiYXNlaXRlbS5hZGRNb2QobW9kKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGFkZGVkKSB7XHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5X2Jhc2VpdGVtKGJhc2VpdGVtLCBcIiN1c2VkX2Jhc2VpdGVtXCIpO1xyXG4gICAgICAgICAgICAgICAgZGlzcGxheV9hdmFpbGFibGVfbW9kcyhtb2RfZ2VuZXJhdG9yLCBiYXNlaXRlbSk7XHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5X21vZF9nZW5fYXBwbGljYWJpbGl0eShiYXNlaXRlbSwgbW9kcyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPIGZsYXNoIGVycm9yXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyByZW1vdmUgbW9kXHJcbiAgICAgICAgJChcIi5yZW1vdmVfbW9kXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgJG1vZCA9ICQodGhpcykucGFyZW50cyhcIi5tb2RcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBiYXNlaXRlbS5yZW1vdmVNb2QoYmFzZWl0ZW0uZ2V0TW9kKCRtb2QuZGF0YShcInByaW1hcnlcIikpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRpc3BsYXlfYmFzZWl0ZW0oYmFzZWl0ZW0sIFwiI3VzZWRfYmFzZWl0ZW1cIik7XHJcbiAgICAgICAgICAgIGRpc3BsYXlfYXZhaWxhYmxlX21vZHMobW9kX2dlbmVyYXRvciwgYmFzZWl0ZW0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGlsdmwgaGFuZGxlXHJcbiAgICAgICAgJChcImlucHV0LmlsdmxcIikub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBiYXNlaXRlbS5pdGVtX2xldmVsID0gKyQodGhpcykudmFsKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkaXNwbGF5X2F2YWlsYWJsZV9tb2RzKG1vZF9nZW5lcmF0b3IsIGJhc2VpdGVtKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyByYXJpdHkgaGFuZGxlXHJcbiAgICAgICAgJChcIiNpdGVtX3Jhcml0aWVzXCIpLm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFlbJChcIm9wdGlvbjpzZWxlY3RlZFwiLCB0aGlzKS52YWwoKV07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkaXNwbGF5X2Jhc2VpdGVtKGJhc2VpdGVtLCBcIiN1c2VkX2Jhc2VpdGVtXCIpO1xyXG4gICAgICAgICAgICBkaXNwbGF5X2F2YWlsYWJsZV9tb2RzKG1vZF9nZW5lcmF0b3IsIGJhc2VpdGVtKTtcclxuICAgICAgICAgICAgZGlzcGxheV9tb2RfZ2VuX2FwcGxpY2FiaWxpdHkoYmFzZWl0ZW0sIG1vZHMpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGV4cGFuZCBtb2QgZ3JvdXBzXHJcbiAgICAgICAgJChcIiNleHBhbmRfbW9kc1wiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJleHBhbmRcIik7XHJcbiAgICAgICAgICAgICQoXCJ0YWJsZS5tb2RzXCIpLmFkZENsYXNzKFwiZXhwYW5kZWRcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkKFwidGJvZHkubW9kczpub3QoLnRlbXBsYXRlKVwiKS5zaG93KCk7XHJcbiAgICAgICAgICAgICQoXCJ0Ym9keS5jb3JyZWN0X2dyb3VwOm5vdCgudGVtcGxhdGUpXCIpLmhpZGUoKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gY29sbGFwc2UgbW9kIGdyb3VwcyA9IGludmVydCAjZXhwYW5kX21vZHNcclxuICAgICAgICAkKFwiI2NvbGxhcHNlX21vZHNcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQoXCJ0YWJsZS5tb2RzXCIpLnJlbW92ZUNsYXNzKFwiZXhwYW5kZWRcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkKFwidGJvZHkubW9kczpub3QoLnRlbXBsYXRlKVwiKS5oaWRlKCk7XHJcbiAgICAgICAgICAgICQoXCJ0Ym9keS5jb3JyZWN0X2dyb3VwOm5vdCgudGVtcGxhdGUpXCIpLnNob3coKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBkaXNwbGF5IHN0YXRzIHdpdGggbW9kcyBpbiBpdGVtYm94IGhhbmRsZVxyXG4gICAgICAgICQoXCIjaXRlbWJveF9zdGF0c193aXRoX21vZHNcIikub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKFwiLml0ZW1ib3ggLm1vZHMgLm1vZCA+ICo6bm90KC5zdGF0cylcIikudG9nZ2xlKCQodGhpcykucHJvcChcImNoZWNrZWRcIikpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGRpc3BsYXkgZ3JvdXAgb2YgTW9kR2VuZXJhdG9ycyBoYW5kbGVcclxuICAgICAgICAkKFwiI3Nob3dfY3VycmVuY2llc1wiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJChcIiNNb2RHZW5lcmF0b3IgZmllbGRzZXQuY3VycmVuY2llc1wiKS50b2dnbGUoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAkKFwiI3Nob3dfbWFzdGVyYmVuY2hlc1wiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJChcIiNNb2RHZW5lcmF0b3IgZmllbGRzZXQubWFzdGVyYmVuY2hlc1wiKS50b2dnbGUoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBoaWRlIGdyb3VwIG9mIE1vZEdlbmVyYXRvcnMgaGFuZGxlXHJcbiAgICAgICAgJChcIiNNb2RHZW5lcmF0b3IgZmllbGRzZXQgYS5jbG9zZV9maWVsZHNldFwiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJCh0aGlzKS5wYXJlbnRzKFwiZmllbGRzZXRcIikuaGlkZSgpOyBcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBpdGVtX2ZpeGVkX3RvcCA9ICQoXCIjSXRlbVwiKS5vZmZzZXQoKS50b3A7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gI0l0ZW0gZml4ZWRcclxuICAgICAgICAkKHdpbmRvdykub24oXCJzY3JvbGxcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgJHdpbmRvdyA9ICQod2luZG93KTtcclxuICAgICAgICAgICAgdmFyICRJdGVtID0gJChcIiNJdGVtXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG9mZnNldCA9ICR3aW5kb3cuc2Nyb2xsVG9wKCkgLSBpdGVtX2ZpeGVkX3RvcDtcclxuICAgICAgICAgICAgaWYgKG9mZnNldCA+IDApIHtcclxuICAgICAgICAgICAgICAgICRJdGVtLmNzcyh7dG9wOiBvZmZzZXQgKyBcInB4XCJ9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHRlc3QgZG9tIGhhbmRsZXNcclxuICAgICAgICBcclxuICAgICAgICAvLyBhbGwgYWZmaXhlcyBzZWxlY3RlZCBieSBkZWZhdWx0XHJcbiAgICAgICAgJChcImlucHV0Lk1vZEdlbmVyYXRvcjpyYWRpb1wiKS5maWx0ZXIoXCI6Zmlyc3RcIikucHJvcChcImNoZWNrZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgJChcImlucHV0Lk1vZEdlbmVyYXRvcjpyYWRpb1wiKS5maWx0ZXIoXCI6Y2hlY2tlZFwiKS50cmlnZ2VyKFwiY2hhbmdlXCIpO1xyXG5cclxuICAgICAgICAvLyQoXCIjcHJlZml4ZXMgdGJvZHk6bm90KC50ZW1wbGF0ZSkgLmFkZF9tb2Q6Zmlyc3RcIikudHJpZ2dlcihcImNsaWNrXCIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQoXCIjdXNlX21vZF9nZW5cIikudHJpZ2dlcihcImNsaWNrXCIpO1xyXG4gICAgfSk7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGludGVyZmFjZSBBcHBsaWNhYmxlXHJcbiAgICAgKi9cclxuICAgIHZhciBBcHBsaWNhYmxlID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc2V0QXBwbGljYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQ2FjaGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBBcHBsaWNhYmxlLm1hcCA9IGZ1bmN0aW9uIChtb2RfY29sbGVjdGlvbiwgbW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgIHJldHVybiAkLm1hcChtb2RfY29sbGVjdGlvbi5zbGljZSgpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIGlmIChBcHBsaWNhYmxlLmltcGxlbWVudGVkQnkobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgbW9kLmFwcGxpY2FibGVUbyhtb2RfY29udGFpbmVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgQXBwbGljYWJsZS5tb2RzID0gZnVuY3Rpb24gKG1vZF9jb2xsZWN0aW9uLCBtb2RfY29udGFpbmVyLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgcmV0dXJuICQuZ3JlcChtb2RfY29sbGVjdGlvbi5zbGljZSgpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBBcHBsaWNhYmxlLmltcGxlbWVudGVkQnkobW9kKSAmJiBtb2QuYXBwbGljYWJsZVRvKG1vZF9jb250YWluZXIsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gaW50ZXJmYWNlIHBhdHRlcm5cclxuICAgIEFwcGxpY2FibGUuaW1wbGVtZW50ZWRCeSA9IGZ1bmN0aW9uIChjbGF6eikge1xyXG4gICAgICAgIHJldHVybiAgY2xhenouYXBwbGljYWJsZVRvICE9PSBfX3VuZGVmaW5lZDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEFwcGxpY2FibGUuVU5TQ0FOTkVEID0gMDtcclxuICAgIEFwcGxpY2FibGUuU1VDQ0VTUyA9IDE7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gQXBwbGljYWJsZTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuL0luaGVyaXRhbmNlJyk7XHJcbiAgICByZXF1aXJlKCcuL2NvbmNlcm5zL0FycmF5Jyk7XHJcbiAgICBcclxuICAgIGlmICh3aW5kb3cualF1ZXJ5ID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJuZWVkIGpRdWVyeSBvYmplY3Qgd2l0aCB3aW5kb3cgY29udGV4dFwiKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB2YXIgJCA9IHdpbmRvdy5qUXVlcnk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgRGF0YURlcGVuZGVuY3lcclxuICAgICAqIFxyXG4gICAgICogY2xhc3MgZm9yIGxvYWRpbmcgYSBqc29uIGRhdGFcclxuICAgICAqL1xyXG4gICAgdmFyIERhdGFEZXBlbmRlbmN5ID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCBwYXRoIHRvIGpzb24gZGF0YVxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBsb2FkaW5nX2luZGljYXRvciBqcXVlcnkgc2VsZWN0b3IgZm9yIGxvYWRpbmcgaW5kaWNhdG9yIGNsYXNzXHJcbiAgICAgICAgICogQHJldHVybnMge0RhdGFEZXBlbmRlbmN5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChwYXRoLCBsb2FkaW5nX2luZGljYXRvcikge1xyXG4gICAgICAgICAgICB0aGlzLnBhdGggPSBwYXRoO1xyXG4gICAgICAgICAgICB0aGlzLmxvYWRpbmdfaW5kaWNhdG9yID0gbG9hZGluZ19pbmRpY2F0b3I7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLnN0YXRlX2F0dHIgPSBEYXRhRGVwZW5kZW5jeS5TVEFURV9BVFRSO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcmV0dXJucyAkLmdldEpTT04gXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZG9uZSBjYWxsYmFjayBvbiAkLmFqYXguZG9uZVxyXG4gICAgICAgICAqIEByZXR1cm5zIHskLkRlcmVmZXJyZWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0SlNPTjogZnVuY3Rpb24gKGRvbmUpIHtcclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICAkKHRoaXMubG9hZGluZ19pbmRpY2F0b3IpLmF0dHIodGhpcy5zdGF0ZV9hdHRyLCBEYXRhRGVwZW5kZW5jeS5TVEFURS5MT0FESU5HKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAkLmdldEpTT04odGhpcy5wYXRoLCBkb25lKVxyXG4gICAgICAgICAgICAgICAgLmRvbmUoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICQodGhhdC5sb2FkaW5nX2luZGljYXRvcikuYXR0cih0aGF0LnN0YXRlX2F0dHIsIERhdGFEZXBlbmRlbmN5LlNUQVRFLkRPTkUpO1xyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIC5mYWlsKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICAkKHRoYXQubG9hZGluZ19pbmRpY2F0b3IpLmF0dHIodGhhdC5zdGF0ZV9hdHRyLCBEYXRhRGVwZW5kZW5jeS5TVEFURS5GQUlMKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBEYXRhRGVwZW5kZW5jeS5TVEFURSA9IHtcclxuICAgICAgICBMT0FESU5HOiAxLFxyXG4gICAgICAgIERPTkU6IDIsXHJcbiAgICAgICAgRkFJTDogM1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBkZWZhdWx0IGxvYWRpbmcgc3RhdGUgYXR0clxyXG4gICAgICovXHJcbiAgICBEYXRhRGVwZW5kZW5jeS5TVEFURV9BVFRSID0gXCJkYXRhLWxvYWRpbmctc3RhdGVcIjtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBEYXRhRGVwZW5kZW5jeTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgXHJcbiAgICB2YXIgTm90Rm91bmRFeGNlcHRpb24gPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChtc2cpIHtcclxuICAgICAgICAgICAgdGhpcy5tZXNzYWdlICA9IG1zZztcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBOb3RGb3VuZEV4Y2VwdGlvbjtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuL0luaGVyaXRhbmNlJyk7XHJcbiAgICByZXF1aXJlKCcuL2NvbmNlcm5zL0FycmF5Jyk7XHJcbiAgICBcclxuICAgIGlmICgkID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgIHZhciAkID0gcmVxdWlyZSgnLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiB0YWJsZSByb3cgZnJvbSBjb250ZW50LmdncGtcclxuICAgICAqL1xyXG4gICAgdmFyIEdncGtFbnRyeSA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMucHJvcHMgPSBwcm9wcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGNvbW1hIHNlcGFyYXRlZCB2YWx1ZXMgYXJlIGFycmF5c1xyXG4gICAgICAgICAqIGFscmVhZHkgaW50IGNhc3QgaWYgcG9zc2libGVcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHZhbHVlQXNBcnJheTogZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgICAgICAvLyBmaWx0ZXIoZW1wdHkpICsgbWFwKHBhcnNlSW50KVxyXG4gICAgICAgICAgICByZXR1cm4gJC5tYXAodGhpcy5nZXRQcm9wKGtleSkuc3BsaXQoXCIsXCIpLCBmdW5jdGlvbiAobikge1xyXG4gICAgICAgICAgICAgICAgaWYgKG4gPT09IG51bGwgfHwgbiA9PT0gJycpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGlzTmFOKCtuKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuICtuO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldFByb3A6IGZ1bmN0aW9uIChrZXkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMucHJvcHNba2V5XSA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwia2V5IGBcIiArIGtleSArIFwiYCBkb2VzbnQgZXhpc3RcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJvcHNba2V5XTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNldFByb3A6IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnByb3BzW2tleV0gIT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnByb3BzW2tleV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEdncGtFbnRyeTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuL0luaGVyaXRhbmNlJyk7XHJcbiAgICB2YXIgUGF0aCA9IHJlcXVpcmUoJy4vUGF0aCcpO1xyXG4gICAgXHJcbiAgICB2YXIgSGFzaGJhbmcgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChwcmVmaXgpIHtcclxuICAgICAgICAgICAgdGhpcy5wYXJhbXMgPSB7fTtcclxuICAgICAgICAgICAgdGhpcy5wYXRoID0gbmV3IFBhdGgoXCJcIik7XHJcbiAgICAgICAgICAgIHRoaXMucHJlZml4ID0gcHJlZml4O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5vbl9jaGFuZ2UgPSBudWxsO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgb25DaGFuZ2U6IGZ1bmN0aW9uIChjYikge1xyXG4gICAgICAgICAgICB0aGlzLm9uX2NoYW5nZSA9IGNiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdHJpZ2dlckNoYW5nZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHRoaXMub25fY2hhbmdlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5vbl9jaGFuZ2UuYXBwbHkodGhpcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcclxuICAgICAgICAgKiBAcGFyYW0ge01peGVkfSB2YWx1ZVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtIYXNoYmFuZ30gdGhpcyB0byBjaGFpblxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNldFBhcmFtczogZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgICAgICAgICAgdGhpcy5wYXJhbXNba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gY2hhaW5hYmxlXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZ2V0UGF0aDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcclxuICAgICAgICAgKiBAcmV0dXJucyB7SGFzaGJhbmd9IHRoaXMgdG8gY2hhaW5cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZXRQYXRoOiBmdW5jdGlvbiAocGF0aCkge1xyXG4gICAgICAgICAgICB0aGlzLnBhdGggPSBuZXcgUGF0aChwYXRoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGNoYWluYWJsZVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdlbmVyYXRlcyB1cmwgZnJvbSBjbGFzcyBwcm9wZXJ0aWVzXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB1cmw6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHVybCA9IFwiI1wiICsgdGhpcy5wcmVmaXggKyB0aGlzLnBhdGg7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoISQuaXNFbXB0eU9iamVjdCh0aGlzLnBhcmFtcykpIHtcclxuICAgICAgICAgICAgICAgIHVybCArPSBcIj9cIiArIEhhc2hiYW5nLnF1ZXJ5X3N0cmluZyh0aGlzLnBhcmFtcyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB1cmw7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBwYXJzZTogZnVuY3Rpb24gKHVybCkge1xyXG4gICAgICAgICAgICB0aGlzLmluaXQoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdXJsICE9PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciB1cmxfbWF0Y2ggPSB1cmwubWF0Y2goLyEoW1xcd1xcL10rKShcXD8uKik/Lyk7XHJcbiAgICAgICAgICAgIGlmICh1cmxfbWF0Y2ggIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0UGF0aCh1cmxfbWF0Y2hbMV0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRQYXJhbXModXJsX21hdGNoWzJdKTtcclxuICAgICAgICAgICAgICAgIHRoaXMudHJpZ2dlckNoYW5nZSgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIHdpdGhXaW5kb3c6IGZ1bmN0aW9uICh3aW5kb3cpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGFyc2Uod2luZG93LmxvY2F0aW9uLmhhc2guc2xpY2UoMSkpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBIYXNoYmFuZy5mcm9tV2luZG93ID0gZnVuY3Rpb24gKHdpbmRvdykge1xyXG4gICAgICAgIHJldHVybiBuZXcgSGFzaGJhbmcoKS53aXRoV2luZG93KHdpbmRvdyk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBIYXNoYmFuZy5wYXJzZSA9IGZ1bmN0aW9uICh1cmwpIHtcclxuICAgICAgICByZXR1cm4gbmV3IEhhc2hiYW5nLnBhcnNlKHVybCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBIYXNoYmFuZy5xdWVyeV9zdHJpbmcgPSBmdW5jdGlvbiAocGFyYW1zKSB7XHJcbiAgICAgICAgcmV0dXJuICQubWFwKHBhcmFtcywgZnVuY3Rpb24gKHZhbHVlLCBrZXkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGtleSArIFwiPVwiICsgdmFsdWU7XHJcbiAgICAgICAgfSkuam9pbihcIiZcIik7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEhhc2hiYW5nO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIFNpbXBsZSBKYXZhU2NyaXB0IEluaGVyaXRhbmNlXHJcbiAqIEJ5IEpvaG4gUmVzaWcgaHR0cDovL2Vqb2huLm9yZy9cclxuICogTUlUIExpY2Vuc2VkLlxyXG4gKi9cclxuLy8gSW5zcGlyZWQgYnkgYmFzZTIgYW5kIFByb3RvdHlwZVxyXG4oZnVuY3Rpb24oKXtcclxuICB2YXIgaW5pdGlhbGl6aW5nID0gZmFsc2UsIGZuVGVzdCA9IC94eXovLnRlc3QoZnVuY3Rpb24oKXt4eXo7fSkgPyAvXFxiX3N1cGVyXFxiLyA6IC8uKi87XHJcbiBcclxuICAvLyBUaGUgYmFzZSBDbGFzcyBpbXBsZW1lbnRhdGlvbiAoZG9lcyBub3RoaW5nKVxyXG4gIHZhciBDbGFzcyA9IGZ1bmN0aW9uKCl7fTtcclxuIFxyXG4gIC8vIENyZWF0ZSBhIG5ldyBDbGFzcyB0aGF0IGluaGVyaXRzIGZyb20gdGhpcyBjbGFzc1xyXG4gIENsYXNzLmV4dGVuZCA9IGZ1bmN0aW9uKHByb3ApIHtcclxuICAgIHZhciBfc3VwZXIgPSB0aGlzLnByb3RvdHlwZTtcclxuICAgXHJcbiAgICAvLyBJbnN0YW50aWF0ZSBhIGJhc2UgY2xhc3MgKGJ1dCBvbmx5IGNyZWF0ZSB0aGUgaW5zdGFuY2UsXHJcbiAgICAvLyBkb24ndCBydW4gdGhlIGluaXQgY29uc3RydWN0b3IpXHJcbiAgICBpbml0aWFsaXppbmcgPSB0cnVlO1xyXG4gICAgdmFyIHByb3RvdHlwZSA9IG5ldyB0aGlzKCk7XHJcbiAgICBpbml0aWFsaXppbmcgPSBmYWxzZTtcclxuICAgXHJcbiAgICAvLyBDb3B5IHRoZSBwcm9wZXJ0aWVzIG92ZXIgb250byB0aGUgbmV3IHByb3RvdHlwZVxyXG4gICAgZm9yICh2YXIgbmFtZSBpbiBwcm9wKSB7XHJcbiAgICAgIC8vIENoZWNrIGlmIHdlJ3JlIG92ZXJ3cml0aW5nIGFuIGV4aXN0aW5nIGZ1bmN0aW9uXHJcbiAgICAgIHByb3RvdHlwZVtuYW1lXSA9IHR5cGVvZiBwcm9wW25hbWVdID09IFwiZnVuY3Rpb25cIiAmJlxyXG4gICAgICAgIHR5cGVvZiBfc3VwZXJbbmFtZV0gPT0gXCJmdW5jdGlvblwiICYmIGZuVGVzdC50ZXN0KHByb3BbbmFtZV0pID9cclxuICAgICAgICAoZnVuY3Rpb24obmFtZSwgZm4pe1xyXG4gICAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICB2YXIgdG1wID0gdGhpcy5fc3VwZXI7XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEFkZCBhIG5ldyAuX3N1cGVyKCkgbWV0aG9kIHRoYXQgaXMgdGhlIHNhbWUgbWV0aG9kXHJcbiAgICAgICAgICAgIC8vIGJ1dCBvbiB0aGUgc3VwZXItY2xhc3NcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIgPSBfc3VwZXJbbmFtZV07XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFRoZSBtZXRob2Qgb25seSBuZWVkIHRvIGJlIGJvdW5kIHRlbXBvcmFyaWx5LCBzbyB3ZVxyXG4gICAgICAgICAgICAvLyByZW1vdmUgaXQgd2hlbiB3ZSdyZSBkb25lIGV4ZWN1dGluZ1xyXG4gICAgICAgICAgICB2YXIgcmV0ID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTsgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLl9zdXBlciA9IHRtcDtcclxuICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHJldDtcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfSkobmFtZSwgcHJvcFtuYW1lXSkgOlxyXG4gICAgICAgIHByb3BbbmFtZV07XHJcbiAgICB9XHJcbiAgIFxyXG4gICAgLy8gVGhlIGR1bW15IGNsYXNzIGNvbnN0cnVjdG9yXHJcbiAgICBmdW5jdGlvbiBDbGFzcygpIHtcclxuICAgICAgLy8gQWxsIGNvbnN0cnVjdGlvbiBpcyBhY3R1YWxseSBkb25lIGluIHRoZSBpbml0IG1ldGhvZFxyXG4gICAgICBpZiAoICFpbml0aWFsaXppbmcgJiYgdGhpcy5pbml0IClcclxuICAgICAgICB0aGlzLmluaXQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxuICAgIH1cclxuICAgXHJcbiAgICAvLyBQb3B1bGF0ZSBvdXIgY29uc3RydWN0ZWQgcHJvdG90eXBlIG9iamVjdFxyXG4gICAgQ2xhc3MucHJvdG90eXBlID0gcHJvdG90eXBlO1xyXG4gICBcclxuICAgIC8vIEVuZm9yY2UgdGhlIGNvbnN0cnVjdG9yIHRvIGJlIHdoYXQgd2UgZXhwZWN0XHJcbiAgICBDbGFzcy5wcm90b3R5cGUuY29uc3RydWN0b3IgPSBDbGFzcztcclxuIFxyXG4gICAgLy8gQW5kIG1ha2UgdGhpcyBjbGFzcyBleHRlbmRhYmxlXHJcbiAgICBDbGFzcy5leHRlbmQgPSBhcmd1bWVudHMuY2FsbGVlO1xyXG4gICBcclxuICAgIHJldHVybiBDbGFzcztcclxuICB9O1xyXG4gIFxyXG4gIG1vZHVsZS5leHBvcnRzID0gQ2xhc3M7XHJcbn0pKCk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZShcIi4vSW5oZXJpdGFuY2VcIik7XHJcbiAgICBcclxuICAgIHJlcXVpcmUoJy4vY29uY2VybnMvQXJyYXknKTtcclxuICAgIHJlcXVpcmUoJy4vY29uY2VybnMvT2JqZWN0Jyk7XHJcbiAgICBcclxuICAgIGlmICgkID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgIHZhciAkID0gcmVxdWlyZSgnLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBMb2NhbGl6YXRpb25cclxuICAgICAqIFxyXG4gICAgICogY2xhc3MgZm9yIGxvY2FsaXppbmcgYSBncm91cCBvZiBlbnRpdGllc1xyXG4gICAgICovXHJcbiAgICB2YXIgTG9jYWxpemF0aW9uID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gZGF0YSB0aGUgbG9jYWxpemF0aW9uIGpzb24gZGF0YVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtMb2NhbGl6YXRpb259XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGRhdGEpIHtcclxuICAgICAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcclxuICAgICAgICAgKiBAcGFyYW0geyp9IC4uLmFyZ3MgcGFyYW1zIGZvciBMb2NhbGl6YXRpb246Omxvb2t1cFN0cmluZ1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtMb2NhbGl6YXRpb246Omxvb2t1cFN0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0OiBmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICAgICAgICAgIHZhciBwYXJhbXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xyXG4gICAgICAgICAgICByZXR1cm4gTG9jYWxpemF0aW9uLmZpbGxTdHJpbmcodGhpcy5sb29rdXBTdHJpbmcoa2V5LCBwYXJhbXMpLCBwYXJhbXMpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY2hlY2tzIGFsbCBwb3NzaWJsZSBzdHJpbmdzIGZyb20ga2V5IGFnYWluc3QgdGhlIHBhcmFtc1xyXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcclxuICAgICAgICAgKiBAcGFyYW0ge2FycmF5fSBwYXJhbXNcclxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fENsYXNzQGNhbGw7ZXh0ZW5kLmZpbGxTdHJpbmcuc3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGxvb2t1cFN0cmluZzogZnVuY3Rpb24gKGtleSwgcGFyYW1zKSB7XHJcbiAgICAgICAgICAgIHZhciB1c2VkX29wdGlvbiA9IG51bGw7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodGhpcy5kYXRhW2tleV0gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZXZlcnkgb3B0aW9uXHJcbiAgICAgICAgICAgICQuZWFjaCh0aGlzLmRhdGFba2V5XSwgZnVuY3Rpb24gKGksIG9wdGlvbikge1xyXG4gICAgICAgICAgICAgICAgaWYgKGlzTmFOKCtpKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlIG9uIHN0cmluZyBrZXlzXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBhbmRfYml0ID0gMTtcclxuICAgICAgICAgICAgICAgIC8vIGxvb3AgdGhyb3VnaCBldmVyeSBhbmQgY29uZGl0aW9uXHJcbiAgICAgICAgICAgICAgICAkLmVhY2gob3B0aW9uLmFuZCwgZnVuY3Rpb24gKGosIHJhbmdlX3N0cmluZykge1xyXG4gICAgICAgICAgICAgICAgICAgIGFuZF9iaXQgJj0gK0xvY2FsaXphdGlvbi5pblJhbmdlKHJhbmdlX3N0cmluZywgcGFyYW1zW2pdKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWFuZF9iaXQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGFuZF9iaXQpIHtcclxuICAgICAgICAgICAgICAgICAgICB1c2VkX29wdGlvbiA9IG9wdGlvbjtcclxuICAgICAgICAgICAgICAgICAgICAvLyBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHVzZWRfb3B0aW9uID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKFwibm8gdmFsaWQgbWF0Y2ggZm9yXCIsIHRoaXMuZGF0YVtrZXldLCBcIndpdGhcIiwgcGFyYW1zKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICh1c2VkX29wdGlvbi5oYW5kbGVzKSB7XHJcbiAgICAgICAgICAgICAgICAkLmVhY2godXNlZF9vcHRpb24uaGFuZGxlcywgZnVuY3Rpb24gKGksIGhhbmRsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHBhcmFtc1tpLTFdID0gJC5tYXAocGFyYW1zW2ktMV0sIExvY2FsaXphdGlvbi5oYW5kbGVzW2hhbmRsZV0pO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdXNlZF9vcHRpb24udGV4dCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2codGhpcy5kYXRhW2tleV0sIHVzZWRfb3B0aW9uKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHVzZWRfb3B0aW9uLnRleHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogcmVwbGFjZXMgdGhlIHBhcmFtcyB3aXRoaW4gdGhlIHN0cmluZyB3aXRoIHRoZSBnaXZlbiBwYXJhbXNcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZ1xyXG4gICAgICogQHBhcmFtIHtBcnJheX0gcGFyYW1zXHJcbiAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICovXHJcbiAgICBMb2NhbGl6YXRpb24uZmlsbFN0cmluZyA9IGZ1bmN0aW9uIChzdHJpbmcsIHBhcmFtcykge1xyXG4gICAgICAgICQuZWFjaChwYXJhbXMsIGZ1bmN0aW9uIChpLCBwYXJhbSkge1xyXG4gICAgICAgICAgICBzdHJpbmcgPSBzdHJpbmcucmVwbGFjZShcIntwYXJhbV9cIiArIChpICsgMSkgKyBcIn1cIiwgTG9jYWxpemF0aW9uLnJhbmdlU3RyaW5nKHBhcmFtKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHN0cmluZztcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2hlY2tzIGlmIHZhbHVlcyBhcmUgd2l0aGluIGEgcmFuZ2Vfc3RyaW5nIGZyb20gdGhlIHBvZSBkZXNjIGZpbGVzIFxyXG4gICAgICogQHBhcmFtIHt0eXBlfSByYW5nZV9zdHJpbmdcclxuICAgICAqIEBwYXJhbSB7dHlwZX0gdmFsdWVzXHJcbiAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAqL1xyXG4gICAgTG9jYWxpemF0aW9uLmluUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2Vfc3RyaW5nLCB2YWx1ZXMpIHtcclxuICAgICAgICBpZiAocmFuZ2Vfc3RyaW5nID09PSBfX3VuZGVmaW5lZCB8fCB2YWx1ZXMgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyIHJhbmdlID0gcmFuZ2Vfc3RyaW5nLnNwbGl0KFwifFwiKTtcclxuICAgICAgICB2YXIgdmFsdWUgPSBNYXRoLm1heC5hcHBseShNYXRoLCB2YWx1ZXMpO1xyXG4gICAgICAgICAgICAgXHJcbiAgICAgICAgaWYgKHJhbmdlLmxlbmd0aCA9PT0gMSAmJiAoK3JhbmdlWzBdID09PSArdmFsdWUgfHwgcmFuZ2VbMF0gPT09ICcjJykpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChyYW5nZVswXSA9PT0gJyMnKSB7XHJcbiAgICAgICAgICAgIHJhbmdlWzBdID0gTnVtYmVyLk5FR0FUSVZFX0lORklOSVRZO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAocmFuZ2VbMV0gPT09ICcjJykge1xyXG4gICAgICAgICAgICByYW5nZVsxXSA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCtyYW5nZVswXSA8PSArdmFsdWUgJiYgK3ZhbHVlIDw9ICtyYW5nZVsxXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgTG9jYWxpemF0aW9uLnJhbmdlU3RyaW5nID0gZnVuY3Rpb24gKHJhbmdlKSB7XHJcbiAgICAgICAgaWYgKHJhbmdlLmxlbmd0aCA8IDIgfHwgcmFuZ2VbMF0gPT09IHJhbmdlWzFdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByYW5nZVswXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIFwiKFwiICsgcmFuZ2Uuam9pbihcIiB0byBcIikgKyBcIilcIjtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogbGFtYmRhcyAgZm9yIHBhcmFtZXRlciBoYW5kbGVzXHJcbiAgICAgKi9cclxuICAgIExvY2FsaXphdGlvbi5oYW5kbGVzID0ge1xyXG4gICAgICAgIGRlY2lzZWNvbmRzX3RvX3NlY29uZHM6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpICogMTA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkaXZpZGVfYnlfb25lX2h1bmRyZWQ6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpIC8gMTAwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcGVyX21pbnV0ZV90b19wZXJfc2Vjb25kOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaSAvIDYwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbWlsbGlzZWNvbmRzX3RvX3NlY29uZHM6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpIC8gMTAwMDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5lZ2F0ZTogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIC1pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZGl2aWRlX2J5X29uZV9odW5kcmVkX2FuZF9uZWdhdGU6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAtaSAvIDEwMDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9sZF9sZWVjaF9wZXJjZW50OiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaSAvIDU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBvbGRfbGVlY2hfcGVybXlyaWFkOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaSAvIDUwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcGVyX21pbnV0ZV90b19wZXJfc2Vjb25kXzBkcDogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KE1hdGgucm91bmQoaSAvIDYwLCAwKSwgMTApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcGVyX21pbnV0ZV90b19wZXJfc2Vjb25kXzJkcDogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KE1hdGgucm91bmQoaSAvIDYwLCAyKSwgMTApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbWlsbGlzZWNvbmRzX3RvX3NlY29uZHNfMGRwOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoTWF0aC5yb3VuZChpIC8gMTAwMCwgMCksIDEwKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1pbGxpc2Vjb25kc190b19zZWNvbmRzXzJkcDogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KE1hdGgucm91bmQoaSAvIDEwMDAsIDIpLCAxMCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtdWx0aXBsaWNhdGl2ZV9kYW1hZ2VfbW9kaWZpZXI6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbW9kX3ZhbHVlX3RvX2l0ZW1fY2xhc3M6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTG9jYWxpemF0aW9uO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4vSW5oZXJpdGFuY2UnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBNZXRhZGF0YVxyXG4gICAgICogXHJcbiAgICAgKiByZXByZXNlbnRhdGlvbiBvZiBhIC5vdCBmaWxlIGluIE1FVEFEQVRBIFxyXG4gICAgICovXHJcbiAgICB2YXIgTWV0YURhdGEgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChjbGF6eiwgcHJvcHMpIHtcclxuICAgICAgICAgICAgdGhpcy5jbGF6eiA9IGNsYXp6O1xyXG4gICAgICAgICAgICB0aGlzLnByb3BzID0gcHJvcHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0E6IGZ1bmN0aW9uIChjbGF6eikge1xyXG4gICAgICAgICAgICByZXR1cm4gY2xhenogPT09IHRoaXMuY2xhenogfHwgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9wcy5pbmhlcml0YW5jZS5pbmRleE9mKGNsYXp6KSAhPT0gLTE7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB2YWx1ZU9mOiBmdW5jdGlvbiAoZmFzY2FkZSwga2V5LCBleHBlY3QpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMucHJvcHNbZmFzY2FkZV0gJiYgdGhpcy5wcm9wc1tmYXNjYWRlXVtrZXldKSB7XHJcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKGV4cGVjdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTWV0YURhdGEuRVhQRUNULlNUUklORzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJvcHNbZmFzY2FkZV1ba2V5XVswXTtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIE1ldGFEYXRhLkVYUEVDVC5OVU1CRVI6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiArdGhpcy5wcm9wc1tmYXNjYWRlXVtrZXldWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTWV0YURhdGEuRVhQRUNULkFSUkFZOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9wc1tmYXNjYWRlXVtrZXldO1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiSWxsZWdhbEFyZ3VtZW50IGZvciB2YWx1ZU9mKGZhc2NhZGUsIGtleSwgZXhwZWN0KVwiLCBmYXNjYWRlLCBrZXksIGV4cGVjdCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBfX3VuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgTWV0YURhdGEuYnVpbGQgPSBmdW5jdGlvbiAoY2xhenosIG1ldGFfZGF0YXMpIHtcclxuICAgICAgICB2YXIgbWV0YV9kYXRhID0gbWV0YV9kYXRhc1tjbGF6el07XHJcbiAgICAgICAgaWYgKG1ldGFfZGF0YSA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBuZXcgTWV0YURhdGEoY2xhenosIG1ldGFfZGF0YSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBNZXRhRGF0YS5FWFBFQ1QgPSB7XHJcbiAgICAgICAgTlVNQkVSOiAxLFxyXG4gICAgICAgIFNUUklORzogMixcclxuICAgICAgICBBUlJBWTogM1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNZXRhRGF0YTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgTW9kQ29udGFpbmVyID0gcmVxdWlyZSgnLi9Nb2RDb250YWluZXInKTtcclxuICAgIHZhciBNZXRhRGF0YSA9IHJlcXVpcmUoJy4uL01ldGFEYXRhJyk7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIHZhciBWYWx1ZVJhbmdlID0gcmVxdWlyZSgnLi4vVmFsdWVSYW5nZScpO1xyXG4gICAgdmFyIEdncGtFbnRyeSA9IHJlcXVpcmUoJy4uL0dncGtFbnRyeScpO1xyXG4gICAgdmFyIEl0ZW1JbXBsaWNpdHMgPSByZXF1aXJlKCcuL0l0ZW1JbXBsaWNpdHMnKTtcclxuICAgIHZhciBBcHBsaWNhYmxlTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9BcHBsaWNhYmxlTW9kJyk7XHJcbiAgICBcclxuICAgIGlmICgkID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBJdGVtIENsYXNzIGV4dGVuZHMgQGxpbmsgTW9kQ29udGFpbmVyXHJcbiAgICAgKiBcclxuICAgICAqIHJlcHJlc2VudHMgYW4gaW5nYW1lIGl0ZW0gKGJvb3RzLCBtYXBzLCByaW5ncyBmb3IgZXhhbXBsZSlcclxuICAgICAqIHRoZSBjbGFzcyBvbmx5IHJlcHJlc2VudHMgdGhlIGV4cGxpY2l0cyBhbmQgaXMgYSBmYXNjYWRlIGZvciBhbiBcclxuICAgICAqIGFkZGl0aW9uYWwgaW1wbGljaXQgY29udGFpbmVyXHJcbiAgICAgKi9cclxuICAgIHZhciBJdGVtID0gTW9kQ29udGFpbmVyLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHByb3BzIGZvciBAbGluayBHZ3BrRW50cnlcclxuICAgICAgICAgKiBAcmV0dXJucyB7SXRlbX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAocHJvcHMpIHtcclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICBpZiAoSXRlbS5tZXRhX2RhdGEgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwicGxzIGluaXQgbWV0YSBkYXRhXCIpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGV4cGxpY2l0c1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcigpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZGVmYXVsdFxyXG4gICAgICAgICAgICB0aGlzLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk5PUk1BTDtcclxuICAgICAgICAgICAgdGhpcy5pdGVtX2xldmVsID0gSXRlbS5NQVhfSUxWTDtcclxuICAgICAgICAgICAgdGhpcy5yYW5kb21fbmFtZSA9IFwiUmFuZG9tIE5hbWVcIjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHBhcnNlIGVudHJ5XHJcbiAgICAgICAgICAgIHRoaXMuZW50cnkgPSBuZXcgR2dwa0VudHJ5KHByb3BzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGdldCBtZXRhIGRhdGEga2V5XHJcbiAgICAgICAgICAgIC8vIHBhdGguc3BsaXQoL1tcXFxcL10vKS5wb3AoKSA6PSBiYXNlbmFtZSBcclxuICAgICAgICAgICAgdmFyIGNsYXp6ID0gdGhpcy5lbnRyeS5nZXRQcm9wKFwiSW5oZXJpdHNGcm9tXCIpLnNwbGl0KC9bXFxcXC9dLykucG9wKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBtZXRhIGRhdGEgZXhpc3RzP1xyXG4gICAgICAgICAgICB0aGlzLm1ldGFfZGF0YSA9IE1ldGFEYXRhLmJ1aWxkKGNsYXp6LCBJdGVtLm1ldGFfZGF0YSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBpbXBsaWNpdHNcclxuICAgICAgICAgICAgdGhpcy5pbXBsaWNpdHMgPSBuZXcgSXRlbUltcGxpY2l0cyhbXSk7XHJcbiAgICAgICAgICAgICQuZWFjaCh0aGlzLmVudHJ5LnZhbHVlQXNBcnJheShcIkltcGxpY2l0X01vZHNLZXlzXCIpLCBmdW5jdGlvbiAoXywgbW9kX2tleSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGF0LmltcGxpY2l0cy5hZGRNb2QobmV3IEFwcGxpY2FibGVNb2QoTW9kLm1vZHNbbW9kX2tleV0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY291bGQgbm90IGFkZFwiLCBtb2Rfa2V5KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIGEgbW9kIGlmIHRoZXJlcyByb29tIGZvciBpdFxyXG4gICAgICAgICAqIG5vIHNvcGhpc3RpY2F0ZWQgZG9tYWluIGNoZWNrLiBvbmx5IGlmIGFmZml4IHR5cGUgaXMgZnVsbCBvciBub3RcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAb3ZlcnJpZGVcclxuICAgICAgICAgKiBAcGFyYW0ge01vZH0gbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFkZE1vZDogZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBpZiAoIShtb2QgaW5zdGFuY2VvZiBNb2QpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdtb2QgbXVzdCBiZSBpbnN0YW5jZSBvZiBgTW9kYCcpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAobW9kLmlzUHJlZml4KCkgJiYgdGhpcy5nZXRQcmVmaXhlcygpLmxlbmd0aCA8IHRoaXMubWF4UHJlZml4ZXMoKSB8fCBcclxuICAgICAgICAgICAgICAgICAgICBtb2QuaXNTdWZmaXgoKSAmJiB0aGlzLmdldFN1ZmZpeGVzKCkubGVuZ3RoIDwgdGhpcy5tYXhTdWZmaXhlcygpXHJcbiAgICAgICAgICAgICkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3N1cGVyKG1vZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2R9IG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIHN1Y2Nlc3NcclxuICAgICAgICAgKi9cclxuICAgICAgICBhZGRJbXBsaWNpdHM6IGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGljaXRzLmFkZE1vZChtb2QpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogSXRlbUltcGxpY3RzIGZhc2NhZGVcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kQ29udGFpbmVyQGNhbGw7cmVtb3ZlQWxsTW9kc31cclxuICAgICAgICAgKi9cclxuICAgICAgICByZW1vdmVBbGxJbXBsaWNpdHM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGljaXRzLnJlbW92ZUFsbE1vZHMoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEl0ZW1JbXBsaWNpdHMgZmFzY2FkZVxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kfSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kQ29udGFpbmVyQGNhbGw7cmVtb3ZlTW9kfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlbW92ZUltcGxpY2l0czogZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsaWNpdHMucmVtb3ZlTW9kKG1vZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBJdGVtSW1wbGljaXRzIGZhc2NhZGVcclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gcHJpbWFyeVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2RDb250YWluZXJAY2FsbDtnZXRNb2R9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0SW1wbGljaXQ6IGZ1bmN0aW9uIChwcmltYXJ5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGxpY2l0cy5nZXRNb2QocHJpbWFyeSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBJdGVtSW1wbGljaXRzIGZhc2NhZGVcclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gcHJpbWFyeVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2RDb250YWluZXJAY2FsbDtpbk1vZHN9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5JbXBsaWNpdHM6IGZ1bmN0aW9uIChwcmltYXJ5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGxpY2l0cy5pbk1vZHMocHJpbWFyeSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIGEgbmV3IHRhZyB0byB0aGUgaXRlbSBpZiBpdHMgbm90IGFscmVhZHkgcHJlc2VuXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtpbnR9IHRhZ19rZXlcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBvbiBzdWNjZXNzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYWRkVGFnOiBmdW5jdGlvbiAodGFnX2tleSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy50YWdzLmluZGV4T2YodGFnX2tleSkgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRhZ3MucHVzaCh0YWdfa2V5KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHJlbW92ZXMgYW4gZXhpc3RpbmcgdGFnXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtpbnR9IHRhZ19rZXlcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBvbiBzdWNjZXNzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmVtb3ZlVGFnOiBmdW5jdGlvbiAodGFnX2tleSkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSB0aGlzLnRhZ3MuaW5kZXhPZih0YWdfa2V5KTtcclxuICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50YWdzID0gdGhpcy50YWdzLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFnX2tleTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiByZXR1cm5zIHRhZ3Mgb2YgaXRlbSArIHRhZ3MgZnJvbSBtb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldFRhZ3M6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICQudW5pcXVlKHRoaXMuX3N1cGVyKCkuY29uY2F0KHRoaXMubWV0YV9kYXRhLnByb3BzLnRhZ3MsIHRoaXMuZW50cnkudmFsdWVBc0FycmF5KFwiVGFnc0tleXNcIikpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHJldHVybnMgdGhlIG1heCBwb3NzaWJsZSBudW1iZXIgb2YgdGhlIGdpdmVuIGdlbmVyYXRpb24gdHlwZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBvdmVycmlkZVxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kfSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfSBtYXggbnVtYmVyIG9yIC0xIGlmIG5vdCBwb3NzaWJsZSBhdCBhbGxcclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXhNb2RzT2ZUeXBlOiBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHZhciBnZW5lcmF0aW9uX3R5cGUgPSArbW9kLmdldFByb3AoXCJHZW5lcmF0aW9uVHlwZVwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHN3aXRjaCAoZ2VuZXJhdGlvbl90eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIE1vZC5NT0RfVFlQRS5QUkVGSVg6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4UHJlZml4ZXMoKTtcclxuICAgICAgICAgICAgICAgIGNhc2UgTW9kLk1PRF9UWVBFLlNVRkZJWDpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhTdWZmaXhlcygpO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBNb2QuTU9EX1RZUEUuRU5DSEFOVE1FTlQ6XHJcbiAgICAgICAgICAgICAgICBjYXNlIE1vZC5NT0RfVFlQRS5UQUxJU01BTjpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWF4aW11bSBudW1iZXIgb2YgcHJlZml4ZXNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1heFByZWZpeGVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHN3aXRjaCAodGhpcy5yYXJpdHkpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuTk9STUFMOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAwO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5NQUdJQzpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gMTtcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuUkFSRTpcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuU0hPV0NBU0U6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMubWV0YV9kYXRhLmlzQShcIkFic3RyYWN0SmV3ZWxcIikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDI7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAzO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5VTklRVUU6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWF4aW11bSBudW1iZXIgb2Ygc3VmZml4ZXMgKD1wcmVmaXhlcylcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1heFN1ZmZpeGVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFByZWZpeGVzKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBlcXVpdiBtb2QgZG9tYWluXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge01vZC5ET01BSU4uKn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtb2REb21haW5FcXVpdjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5tZXRhX2RhdGEuaXNBKFwiQWJzdHJhY3RKZXdlbFwiKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1vZC5ET01BSU4uSkVXRUw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMubWV0YV9kYXRhLmlzQShcIkFic3RyYWN0Rmxhc2tcIikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBNb2QuRE9NQUlOLkZMQVNLO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1ldGFfZGF0YS5pc0EoXCJBYnN0cmFjdE1hcFwiKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1vZC5ET01BSU4uTUFQO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBNb2QuRE9NQUlOLklURU07XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBjaGVja3MgaWYgdGhlIGRvbWFpbnMgYXJlIGVxdWl2XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2QuRE9NQUlOLip9IG1vZF9kb21haW5cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBpZiBpbiBkb21haW5cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbkRvbWFpbk9mOiBmdW5jdGlvbiAobW9kX2RvbWFpbikge1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG1vZF9kb21haW4pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgTW9kLkRPTUFJTi5NQVNURVI6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW5Eb21haW5PZihNb2QuRE9NQUlOLklURU0pO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbW9kX2RvbWFpbiA9PT0gdGhpcy5tb2REb21haW5FcXVpdigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRJbXBsaWNpdHM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGljaXRzLmFzQXJyYXkoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldEFsbE1vZHM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXNBcnJheSgpLmNvbmNhdCh0aGlzLmdldEltcGxpY2l0cygpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG5hbWUgb2YgdGhlIGJhc2VfaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYmFzZU5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMucmFyaXR5ID09PSBJdGVtLlJBUklUWS5NQUdJQykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZW50cnkuZ2V0UHJvcChcIk5hbWVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhY3R1YWwgaXRlbSBuYW1lXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBpdGVtTmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBzd2l0Y2ggKHRoaXMucmFyaXR5KSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLk1BR0lDOlxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBuYW1lID0gXCJcIjtcclxuICAgICAgICAgICAgICAgICAgICAvLyBwcmVmaXhcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5nZXRQcmVmaXhlcygpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lICs9IHRoaXMuZ2V0UHJlZml4ZXMoKVswXS5nZXRQcm9wKFwiTmFtZVwiKSArIFwiIFwiO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvLyArIGJhc2VfbmFtZVxyXG4gICAgICAgICAgICAgICAgICAgIG5hbWUgKz0gdGhpcy5lbnRyeS5nZXRQcm9wKFwiTmFtZVwiKTtcclxuICAgICAgICAgICAgICAgICAgICAvLyArIHN1ZmZpeFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmdldFN1ZmZpeGVzKCkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgKz0gXCIgXCIgKyB0aGlzLmdldFN1ZmZpeGVzKClbMF0uZ2V0UHJvcChcIk5hbWVcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuYW1lO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5SQVJFOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnJhbmRvbV9uYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiAnJztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHByaW1hcnkga2V5XHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBwcmltYXJ5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiArdGhpcy5lbnRyeS5nZXRQcm9wKFwiUm93c1wiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHJlcXVpcmVtZW50cyB0byB3ZWFyIHRoaXMgaXRlbVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IHJlcXVpcmVtZW50IGRlc2MgPT4gYW1vdW50XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmVxdWlyZW1lbnRzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciByZXF1aXJlbWVudHMgPSB7fTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICQuZWFjaCh7XHJcbiAgICAgICAgICAgICAgICBMZXZlbDogdGhpcy5yZXF1aXJlZExldmVsKCksXHJcbiAgICAgICAgICAgICAgICBTdHI6IHRoaXMuZW50cnkuZ2V0UHJvcChcIlJlcVN0clwiKSxcclxuICAgICAgICAgICAgICAgIERleDogdGhpcy5lbnRyeS5nZXRQcm9wKFwiUmVxRGV4XCIpLFxyXG4gICAgICAgICAgICAgICAgSW50OiB0aGlzLmVudHJ5LmdldFByb3AoXCJSZXFJbnRcIilcclxuICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGtleSwgcmVxdWlyZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgIGlmIChyZXF1aXJlbWVudCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICByZXF1aXJlbWVudHNba2V5XSA9IHJlcXVpcmVtZW50O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiByZXF1aXJlbWVudHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXF1aXJlZExldmVsOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBNYXRoLm1heC5hcHBseShNYXRoLCBbK3RoaXMuZW50cnkuZ2V0UHJvcChcIkRyb3BMZXZlbFwiKV0uY29uY2F0KCQubWFwKHRoaXMuZ2V0QWxsTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigwLjggKiArbW9kLmdldFByb3AoXCJMZXZlbFwiKSk7XHJcbiAgICAgICAgICAgIH0pKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzdHJpbmcgaWRlbnRpZmllciBvZiB0aGUgaXRlbV9jbGFzc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IGtleSBmcm9tIEBsaW5rIEl0ZW0uSVRFTUNMQVNTRVNcclxuICAgICAgICAgKi9cclxuICAgICAgICBpdGVtY2xhc3NJZGVudDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIHJldHVybiAkLm1hcChJdGVtLklURU1DTEFTU0VTLCBmdW5jdGlvbiAoaXRlbWNsYXNzLCBpZGVudCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCtpdGVtY2xhc3MuUFJJTUFSWSA9PT0gK3RoYXQuZW50cnkuZ2V0UHJvcChcIkl0ZW1DbGFzc1wiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpZGVudDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KVswXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHN0cmluZyBpZGVudGlmaWVyIG9mIHRoZSBpdGVtIHJhcml0eVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9IGtleSBmcm9tIEBsaW5rIEl0ZW0uUkFSSVRZXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmFyaXR5SWRlbnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICByZXR1cm4gJC5tYXAoSXRlbS5SQVJJVFksIGZ1bmN0aW9uIChyYXJpdHksIGlkZW50KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocmFyaXR5ID09PSArdGhhdC5yYXJpdHkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaWRlbnQudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KVswXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGF0dGVtcHRzIHRvIHVwZ3JhZGUgdGhlIHJhcml0eVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIGNoYW5nZSBpbiByYXJpdHlcclxuICAgICAgICAgKi9cclxuICAgICAgICB1cGdyYWRlUmFyaXR5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHN3aXRjaCAodGhpcy5yYXJpdHkpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuTk9STUFMOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5TSE9XQ0FTRTpcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk1BR0lDO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5NQUdJQzpcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHN0YXRzIG9mIG1vZHMgY29tYmluZWRcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBzdGF0X2lkID0+IHZhbHVlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc3RhdHM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRzID0ge307XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBmbGF0dGVuIG1vZHMuc3RhdHNKb2luZWQoKVxyXG4gICAgICAgICAgICAkLmVhY2goJC5tYXAodGhpcy5hc0FycmF5KCkuY29uY2F0KHRoaXMuZ2V0SW1wbGljaXRzKCkpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLnN0YXRzSm9pbmVkKCk7XHJcbiAgICAgICAgICAgIH0pLCBmdW5jdGlvbiAoXywgc3RhdCkge1xyXG4gICAgICAgICAgICAgICAgdmFyIGlkID0gc3RhdC5nZXRQcm9wKFwiSWRcIik7XHJcbiAgICAgICAgICAgICAgICAvLyBncm91cCBieSBzdGF0LklkXHJcbiAgICAgICAgICAgICAgICBpZiAoc3RhdHNbaWRdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdHNbaWRdLnZhbHVlcy5hZGQoc3RhdC52YWx1ZXMpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBzdGF0c1tpZF0gPSBzdGF0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBzdGF0cztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHN0YXRzIGZyb20gdGhlIGl0ZW0gd2l0aCBzdGF0cyBmcm9tIG1vZHMgYXBwbGllZFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGRlc2MgPT4gdmFsdWVyYW5nZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGxvY2FsU3RhdHM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cygpO1xyXG4gICAgICAgICAgICB2YXIgbG9jYWxfc3RhdHMgPSB7fTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFRPRE8gcXVhbGl0eVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMubWV0YV9kYXRhLmlzQSgnQWJzdHJhY3RXZWFwb24nKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gYWRkZWQgZmxhdFxyXG4gICAgICAgICAgICAgICAgJC5lYWNoKHtcclxuICAgICAgICAgICAgICAgICAgICBcInBoeXNpY2FsXCI6ICBuZXcgVmFsdWVSYW5nZSgrdGhpcy5lbnRyeS5nZXRQcm9wKFwiRGFtYWdlTWluXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArdGhpcy5lbnRyeS5nZXRQcm9wKFwiRGFtYWdlTWF4XCIpKSxcclxuICAgICAgICAgICAgICAgICAgICBcImZpcmVcIjogbmV3IFZhbHVlUmFuZ2UoMCwgMCksXHJcbiAgICAgICAgICAgICAgICAgICAgXCJjb2xkXCI6IG5ldyBWYWx1ZVJhbmdlKDAsIDApLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibGlnaHRuaW5nXCI6IG5ldyBWYWx1ZVJhbmdlKDAsIDApLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY2hhb3NcIjogbmV3IFZhbHVlUmFuZ2UoMCwgMClcclxuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChzb3VyY2UsIGRhbWFnZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGF0c1snbG9jYWxfbWluaW11bV9hZGRlZF8nICsgc291cmNlICsgJ19kYW1hZ2UnXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYW1hZ2UubWluID0gc3RhdHNbJ2xvY2FsX21pbmltdW1fYWRkZWRfJyArIHNvdXJjZSArICdfZGFtYWdlJ10udmFsdWVzLmFkZChkYW1hZ2UubWluKTtcclxuICAgICAgICAgICAgICAgICAgICB9ICAgICBcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRzWydsb2NhbF9tYXhpbXVtX2FkZGVkXycgKyBzb3VyY2UgKyAnX2RhbWFnZSddKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhbWFnZS5tYXggPSBzdGF0c1snbG9jYWxfbWF4aW11bV9hZGRlZF8nICsgc291cmNlICsgJ19kYW1hZ2UnXS52YWx1ZXMuYWRkKGRhbWFnZS5tYXgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gXHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE8gY29tYmluZSBlbGUgZGFtYWdlXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFkYW1hZ2UuaXNaZXJvKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxfc3RhdHNbc291cmNlLnVjZmlyc3QoKSArICcgRGFtYWdlJ10gPSBkYW1hZ2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIFRPRE8gY29tYmluZSBlbGVcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gYXBwbHkgaW5jcmVhc2VzXHJcbiAgICAgICAgICAgICAgICBsb2NhbF9zdGF0c1snUGh5c2ljYWwgRGFtYWdlJ10gPSBcclxuICAgICAgICAgICAgICAgICAgICAgICAgSXRlbS5hcHBseVN0YXQobG9jYWxfc3RhdHNbJ1BoeXNpY2FsIERhbWFnZSddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0c1snbG9jYWxfcGh5c2ljYWxfZGFtYWdlXyslJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDApO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBDcml0XHJcbiAgICAgICAgICAgICAgICBsb2NhbF9zdGF0c1snQ3JpdGljYWwgU3RyaWtlIENoYW5jZSddID0gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEl0ZW0uYXBwbHlTdGF0KCt0aGlzLmVudHJ5LmdldFByb3AoJ0NyaXRpY2FsJykgLyAxMDAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzWydsb2NhbF9jcml0aWNhbF9zdHJpa2VfY2hhbmNlXyslJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDIpLnRvU3RyaW5nKCkgKyBcIiVcIjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBBUFNcclxuICAgICAgICAgICAgICAgIGxvY2FsX3N0YXRzWydBdHRhY2tzIFBlciBTZWNvbmQnXSA9IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBJdGVtLmFwcGx5U3RhdCgxMDAwIC8gK3RoaXMuZW50cnkuZ2V0UHJvcChcIlNwZWVkXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0c1snbG9jYWxfYXR0YWNrX3NwZWVkXyslJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDIpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMubWV0YV9kYXRhLmlzQSgnQWJzdHJhY3RBcm1vdXInKSkge1xyXG4gICAgICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICAgICAgLy8gZGVmZW5jZXNcclxuICAgICAgICAgICAgICAgICQuZWFjaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQ29tcG9uZW50QXJtb3VyID0+IHN0YXRfbmFtZVxyXG4gICAgICAgICAgICAgICAgICAgIEFybW91cjogXCJwaHlzaWNhbF9kYW1hZ2VfcmVkdWN0aW9uXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgRXZhc2lvbjogXCJldmFzaW9uXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgRW5lcmd5U2hpZWxkOiBcImVuZXJneV9zaGllbGRcIlxyXG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKGNvbXBvbmVudCwgc3RhdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGluaXRhbCB2YWx1ZVxyXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsX3N0YXRzW2NvbXBvbmVudF0gPSBuZXcgVmFsdWVSYW5nZSgrdGhhdC5lbnRyeS5nZXRQcm9wKGNvbXBvbmVudCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICt0aGF0LmVudHJ5LmdldFByb3AoY29tcG9uZW50KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYWRkZWQgZmxhdFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGF0c1snbG9jYWxfYmFzZV8nICsgc3RhdCArICdfcmF0aW5nJ10pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbG9jYWxfc3RhdHNbY29tcG9uZW50XSA9IGxvY2FsX3N0YXRzW2NvbXBvbmVudF0uYWRkKHN0YXRzWydsb2NhbF9iYXNlXycgKyBzdGF0ICsgJ19yYXRpbmcnXS52YWx1ZXMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAvLyBpbmNyZWFzZVxyXG4gICAgICAgICAgICAgICAgICAgIGxvY2FsX3N0YXRzW2NvbXBvbmVudF0gPSBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIEl0ZW0uYXBwbHlTdGF0KGxvY2FsX3N0YXRzW2NvbXBvbmVudF0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0c1snbG9jYWxfJyArIHN0YXQgKyAnX3JhdGluZ18rJSddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGxvY2FsX3N0YXRzW2NvbXBvbmVudF0uaXNaZXJvKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGxvY2FsX3N0YXRzW2NvbXBvbmVudF07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFRPRE8gY29sb3Igc3RhdHNcclxuICAgICAgICAgICAgcmV0dXJuIGxvY2FsX3N0YXRzO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIHRha2VzIGEgaW5jcmVhc2VkIHN0YXQgYW5kIGFwcGxpZXMgaXQgdG8gdGhlIHZhbHVlXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7VmFsdWVSYW5nZXxOdW1iZXJ9IHZhbHVlXHJcbiAgICAgKiBAcGFyYW0ge1N0YXR9IHN0YXRcclxuICAgICAqIEBwYXJhbSB7TnVtYmVyfSBwcmVjaXNpb25cclxuICAgICAqIEByZXR1cm5zIHtWYWx1ZVJhbmdlfVxyXG4gICAgICovXHJcbiAgICBJdGVtLmFwcGx5U3RhdCA9IGZ1bmN0aW9uICh2YWx1ZSwgc3RhdCwgcHJlY2lzaW9uKSB7XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHN0YXQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIDEwMCUgaW5jcmVhc2VkIDo9IDIgPSAoMTAwJSAvIDEwMCkgKyAxXHJcbiAgICAgICAgICAgIHZhciBtdWx0aXBsaWVyID0gc3RhdC52YWx1ZXMubXVsdGlwbHkoMSAvIDEwMCkuYWRkKDEpO1xyXG5cclxuXHJcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IHZhbHVlLm11bHRpcGx5KG11bHRpcGxpZXIpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbXVsdGlwbGllci5tdWx0aXBseSh2YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdC50b0ZpeGVkKHByZWNpc2lvbik7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIG1ldGEgZGF0YSBvYmplY3QgdW5pbml0aWFsaXplZFxyXG4gICAgICovXHJcbiAgICBJdGVtLm1ldGFfZGF0YSA9IG51bGw7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogYWxsIHBvc3NpYmxlIHJhcml0aWVzXHJcbiAgICAgKi9cclxuICAgIEl0ZW0uUkFSSVRZID0ge1xyXG4gICAgICAgIE5PUk1BTDogMSxcclxuICAgICAgICBNQUdJQzogMixcclxuICAgICAgICBSQVJFOiAzLFxyXG4gICAgICAgIFVOSVFVRTogNCxcclxuICAgICAgICBTSE9XQ0FTRTogNVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBtYXhpbXVtIGl0ZW0gbGV2ZWxcclxuICAgICAqL1xyXG4gICAgSXRlbS5NQVhfSUxWTCA9IDEwMDtcclxuICAgIFxyXG4gICAgLyogdGFncyBhcmUgb2Jzb2x0ZS4gdGhleSBhcmUgZGVyaXZhdGVkIGZyb20gdGhlIGluaGVyaXRhbmNlIGNoYWluXHJcbiAgICAgKiB0aGV5IGFyZSBrZXB0IGZvciBoaXN0b3JpYyByZWFzb25zICovXHJcbiAgICBJdGVtLklURU1DTEFTU0VTID0ge1xyXG4gICAgICAgIEFNVUxFVDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiA1LCBcclxuICAgICAgICAgICAgLy8gYW11bGV0LCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFszLCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgUklORzoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiA2LCBcclxuICAgICAgICAgICAgLy8gcmluZywgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMiwgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIENMQVc6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogNywgXHJcbiAgICAgICAgICAgIC8vIGNsYXcsIG9uZWhhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTQsIDgxLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgREFHR0VSOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiA4LCBcclxuICAgICAgICAgICAgLy8gZGFnZ2VyLCBvbmVoYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzEzLCA4MSwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFdBTkQ6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDksIFxyXG4gICAgICAgICAgICAvLyB3YW5kLCBvbmVoYW5kd2VhcG9uLCB3ZWFwb24sIHJhbmdlZFxyXG4gICAgICAgICAgICBUQUdTOiBbOSwgODEsIDgsIDMyXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgU1dPUkRfMUg6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDEwLCBcclxuICAgICAgICAgICAgLy8gc3dvcmQsIG9uZWhhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTIsIDgxLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgVEhSVVNUSU5HX1NXT1JEXzFIOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDExLCBcclxuICAgICAgICAgICAgLy8gc3dvcmQsIG9uZWhhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTIsIDgxLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQVhFXzFIOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDEyLCBcclxuICAgICAgICAgICAgLy8gYXhlLCBvbmVoYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzE1LCA4MSwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIE1BQ0VfMUg6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDEzLCBcclxuICAgICAgICAgICAgLy8gbWFjZSwgb25laGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxMSwgODEsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBCT1c6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMTQsXHJcbiAgICAgICAgICAgIC8vIGJvdywgdHdvaGFuZHdlYXBvbiwgd2VhcG9uLCByYW5nZWRcclxuICAgICAgICAgICAgVEFHUzogWzUsIDgyLCA4LCAzMl1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFNUQUZGOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiAxNSwgXHJcbiAgICAgICAgICAgIC8vIFN0YWZmLCB0d29oYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzEwLCA4MiwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFNXT1JEXzJIOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiAxNiwgXHJcbiAgICAgICAgICAgIC8vIHN3b3JkLCB0d29oYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzEyLCA4MiwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEFYRV8ySDogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogMTcsIFxyXG4gICAgICAgICAgICAvLyBheGUsIHR3b2hhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTUsIDgyLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgTUFDRV8ySDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAxOCwgXHJcbiAgICAgICAgICAgIC8vIG1hY2UsIHR3b2hhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTEsIDgyLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgUVVJVkVSOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDIxLCBcclxuICAgICAgICAgICAgLy8gcXVpdmVyLCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFsyMSwgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEJFTFQ6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMjIsIFxyXG4gICAgICAgICAgICAvLyBiZWx0LCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFsyNiwgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEdMT1ZFUzoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAyMywgXHJcbiAgICAgICAgICAgIC8vIGdsb3ZlcywgYXJtb3VyLCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFsyMiwgNywgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEJPT1RTOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDI0LCBcclxuICAgICAgICAgICAgLy8gYm9vdHMsIGFybW91ciwgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbNCwgNywgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEFSTU9VUjoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAyNSwgXHJcbiAgICAgICAgICAgIC8vIGJvZHlfYXJtb3VyLCBhcm1vdXIsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzE2LCA3LCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgSEVMTUVUOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDI2LCBcclxuICAgICAgICAgICAgLy8gaGVsbWV0LCBhcm1vdXIsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzI1LCA3LCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgU0hJRUxEOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiAyNywgXHJcbiAgICAgICAgICAgIC8vIHNoaWVsZCwgYXJtb3VyLCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFsxLCA3LCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgU0NFUFRSRToge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAzMywgXHJcbiAgICAgICAgICAgIC8vIHNjZXB0cmUsIG9uZWhhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMzcsIDgxLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgTUFQOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDM2LCBcclxuICAgICAgICAgICAgLy8gZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEZJU0hJTkdfUk9EOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDM4LCBcclxuICAgICAgICAgICAgLy8gZmlzaGluZ19yb2RcclxuICAgICAgICAgICAgVEFHUzogWzgwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgTUFQX0ZSQUdNRU5UOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiAzOSxcclxuICAgICAgICAgICAgVEFHUzogW11cclxuICAgICAgICB9LFxyXG4gICAgICAgIEpFV0VMOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDQyLCBcclxuICAgICAgICAgICAgLy8gZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMF1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEl0ZW07XHJcbn0pLmNhbGwodGhpcyk7XHJcblxyXG4iLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgTW9kQ29udGFpbmVyID0gcmVxdWlyZShcIi4vTW9kQ29udGFpbmVyXCIpO1xyXG4gICAgdmFyIE1vZCA9IHJlcXVpcmUoJy4uL21vZHMvTW9kJyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgSXRlbUltcGxpY2l0cyBleHRlbmRzIE1vZENvbnRhaW5lclxyXG4gICAgICogXHJcbiAgICAgKiBob2xkcyBhbGwgaW1wbGljaXRzIGZvciBpdGVtc1xyXG4gICAgICovXHJcbiAgICB2YXIgSXRlbUltcGxpY2l0cyA9IE1vZENvbnRhaW5lci5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kfSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBvbiBzdWNjZXNzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYWRkTW9kOiBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIGlmICghKG1vZCBpbnN0YW5jZW9mIE1vZCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzUm9vbUZvcihtb2QpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc3VwZXIobW9kKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge01vZH0gbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn0gLTEgaWYgbm90IHBvc3NpYmxlIGF0IGFsbFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1heE1vZHNPZlR5cGU6IGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgaWYgICgrbW9kLmdldFByb3AoXCJHZW5lcmF0aW9uVHlwZVwiKSA9PT0gTW9kLk1PRF9UWVBFLlBSRU1BREUpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiA1O1xyXG4gICAgICAgICAgICB9IFxyXG4gICAgICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gSXRlbUltcGxpY2l0cztcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICAndXNlIHN0cmljdCc7XHJcbiAgICBcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoXCIuLi9Jbmhlcml0YW5jZVwiKTtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKFwiLi4vbW9kcy9Nb2RcIik7XHJcbiAgICBcclxuICAgIGlmICgkID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qXHJcbiAgICAgKiBNb2RDb250YWluZXIgY2xhc3NcclxuICAgICAqIFxyXG4gICAgICogQ29udGFpbmVyIGZvciBAbGluayBNb2RcclxuICAgICAqL1xyXG4gICAgdmFyIE1vZENvbnRhaW5lciA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gbW9kcyBhbGwgbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2RDb250YWluZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKG1vZHMpIHtcclxuICAgICAgICAgICAgaWYgKG1vZHMgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZHMgPSBbXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kcyA9IG1vZHM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIEB2YXIgdGhpcy5tb2RzIEFycmF5PE1vZD5cclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLnRhZ3MgPSBbXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgYSBuZXcgbm9uLWV4aXN0aW5nIG1vZFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kfSBuZXdfbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFkZE1vZDogZnVuY3Rpb24gKG5ld19tb2QpIHtcclxuICAgICAgICAgICAgaWYgKCEobmV3X21vZCBpbnN0YW5jZW9mIE1vZCkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ21vZCBtdXN0IGJlIGluc3RhbmNlIG9mIGBNb2RgJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMuaW5Nb2RzKG5ld19tb2QuZ2V0UHJvcChcIlJvd3NcIikpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RzLnB1c2gobmV3X21vZCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiB0cnVuY2F0ZXMgbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlbW92ZUFsbE1vZHM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy5tb2RzID0gW107XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiByZW1vdmVzIGFuIGV4aXN0aW5nIG1vZFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gb2xkX21vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ8Qm9vbGVhbn0gZmFsc2UgaWYgbm9uLWV4aXN0aW5nXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmVtb3ZlTW9kOiBmdW5jdGlvbiAob2xkX21vZCkgeyAgXHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMuaW5Nb2RzKG9sZF9tb2QuZ2V0UHJvcChcIlJvd3NcIikpO1xyXG4gICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZHMuc3BsaWNlKGluZGV4LCAxKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBpbmRleDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBnZXRzIGEgbW9kIGJ5IHByaW1hcnlcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IHByaW1hcnlcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kfSBudWxsIGlmIG5vdCBleGlzdGluZ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldE1vZDogZnVuY3Rpb24gKHByaW1hcnkpIHtcclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5pbk1vZHMocHJpbWFyeSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tb2RzW2luZGV4XTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGNoZWNrcyBpZiBhIG1vZCBpcyBpbiB0aGUgY29udGFpbmVyXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IHByaW1hcnkgcHJpbWFyeSBvZiB0aGUgbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn0gaW5kZXggb2YgdGhlIG1vZHNcclxuICAgICAgICAgKi9cclxuICAgICAgICBpbk1vZHM6IGZ1bmN0aW9uIChwcmltYXJ5KSB7XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IC0xO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJC5lYWNoKHRoaXMubW9kcywgZnVuY3Rpb24gKGksIG1vZCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKCttb2QuZ2V0UHJvcChcIlJvd3NcIikgPT09ICtwcmltYXJ5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiByZXR1cm5zIHRhZ3Mgb2YgdGhlIG1vZHMgaW4gdGhlIGNvbnRhaW5lclxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRUYWdzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIC8vIGpRdWVyeSBtYXAgYWxyZWFkeSBmbGF0dGVuc1xyXG4gICAgICAgICAgICByZXR1cm4gJC51bmlxdWUoJC5tYXAodGhpcy5tb2RzLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLnZhbHVlQXNBcnJheShcIlRhZ3NLZXlzXCIpO1xyXG4gICAgICAgICAgICB9KSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBpbnRlcnNlY3RzIGFsbCB0YWdzIHdpdGggdGhlIG9uZXMgb24gdGhlIGl0ZW1cclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhbGxfdGFnc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX0gdGFncyBmcm9tIHRoZSBpdGVtIHdpdGggdGhlaXIgcHJvcGVydGllc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldFRhZ3NXaXRoUHJvcHM6IGZ1bmN0aW9uIChhbGxfdGFncykge1xyXG4gICAgICAgICAgICB2YXIgdGFncyA9IHRoaXMuZ2V0VGFncygpO1xyXG4gICAgICAgICAgICByZXR1cm4gJC5ncmVwKGFsbF90YWdzLCBmdW5jdGlvbiAodGFnX3Byb3BzKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFncy5pbmRleE9mKCt0YWdfcHJvcHMuUm93cykgIT09IC0xO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFsbCBwcmVmaXggbW9kc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRQcmVmaXhlczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJC5ncmVwKHRoaXMubW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5pc1ByZWZpeCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFsbCBzdWZmaXggbW9kc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRTdWZmaXhlczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJC5ncmVwKHRoaXMubW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5pc1N1ZmZpeCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHN1ZmZpeGVzIGFuZCBwcmVmaXhlc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRBZmZpeGVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIC8vIHJhdGhlciBvcmRlciB0aGUgbW9kcyB0aGFuIG1peCBlbSB1cFxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQcmVmaXhlcygpLmNvbmNhdCh0aGlzLmdldFN1ZmZpeGVzKCkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWxsIG1vZHMgXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXNBcnJheTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IG1vZF90eXBlIHNlYXJjaGVkIEdlbmVyYXRpb25UeXBlXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBudW1iZXJPZk1vZHNPZlR5cGU6IGZ1bmN0aW9uIChtb2RfdHlwZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gJC5ncmVwKHRoaXMubW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuICttb2QuZ2V0UHJvcChcIkdlbmVyYXRpb25UeXBlXCIpID09PSBtb2RfdHlwZTtcclxuICAgICAgICAgICAgfSkubGVuZ3RoO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY2hlY2tzIGlmIHRoZXJlcyBtb3JlIHBsYWNlIGZvciBhIG1vZCB3aXRoIHRoZWlyIGdlbmVyYXRpb250eXBlXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2R9IG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIHJvb20gZm9yXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaGFzUm9vbUZvcjogZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5udW1iZXJPZk1vZHNPZlR5cGUoK21vZC5nZXRQcm9wKFwiR2VuZXJhdGlvblR5cGVcIikpIDwgdGhpcy5tYXhNb2RzT2ZUeXBlKG1vZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAYWJzdHJhY3RcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWF4TW9kc09mVHlwZTogZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIm92ZXJyaWRlIGFic3RyYWN0IG1heE1vZHNPZlR5cGVcIik7XHJcbiAgICAgICAgICAgIHJldHVybiAtMTtcclxuICAgICAgICB9XHJcbiAgICB9KTsgXHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTW9kQ29udGFpbmVyO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOiBmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gcmVxdWlyZSgnLi9DdXJyZW5jeScpO1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IHJlcXVpcmUoJy4vVHJhbnNtdXRlJyk7XHJcbiAgICB2YXIgSXRlbSA9IHJlcXVpcmUoJy4uL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICBcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBBbGNoZW15IGV4dGVuZHMgQ3VycmVuY3lcclxuICAgICAqIFxyXG4gICAgICogaW5nYW1lIHJlcHJlc2VudGF0aW9uIG9mIE9yYiBvZiBBbGNoZW15XHJcbiAgICAgKiBtb2QgZ2VuZXJhdGlvbiBtb3N0IGxpa2VseSBub3QgYWNjdXJhdGUgYmVjYXVzZSB3ZSBqdXN0IHJvbGwgNC02IG1vZHNcclxuICAgICAqIGFuZCBjb3JyZWxhdGUgI3ByZWZpeHMvc3VmZml4ZXMgdG8gZWFjaGUgb3RoZXIgaWYgdGhlIHJhdGlvID49IDM6MVxyXG4gICAgICovXHJcbiAgICB2YXIgQWxjaGVteSA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBbGNoZW15fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChhbGxfbW9kcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihhbGxfbW9kcywgVHJhbnNtdXRlLm1vZF9maWx0ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLmtsYXNzID0gXCJBbGNoZW15XCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIDQtNlxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgICAgICAgIHZhciBpO1xyXG4gICAgICAgICAgICB2YXIgbmV3X21vZHM7XHJcbiAgICAgICAgICAgIHZhciBwcmVmaXhlcywgc3VmZml4ZXM7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodGhpcy5hcHBsaWNhYmxlVG8oaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgIC8vIHVwZ3JhZGUgdG8gcmFyZVxyXG4gICAgICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5SQVJFO1xyXG5cclxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDEsIG5ld19tb2RzID0gTWF0aC5yYW5kKDQsIDYpOyBpIDw9IG5ld19tb2RzOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtLmFkZE1vZCh0aGlzLmNob29zZU1vZChpdGVtKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHByZWZpeGVzID0gaXRlbS5nZXRQcmVmaXhlcygpLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIHN1ZmZpeGVzID0gaXRlbS5nZXRTdWZmaXhlcygpLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gY29ycmVjdCBkaWZmZXJlbmNlcyBiZXR3ZWVuICNwcmVmaXhlcywgI3N1ZmZpeGVzID49IDJcclxuICAgICAgICAgICAgICAgIGZvciAoaSA9IDEsIG5ld19tb2RzID0gTWF0aC5tYXgoMCwgTWF0aC5hYnMocHJlZml4ZXMgLSBzdWZmaXhlcykgLSAxKTsgaSA8PSBuZXdfbW9kczsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWFwcyBtb2Q6OmFwcGxpY2FibGVUbyBhcyBpZiBpdCB3ZXJlIGFscmVhZHkgbWFnaWNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1hcDogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgdXBncmFkZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gdGhpcy5fc3VwZXIoaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ3JlcHMgbW9kOjphcHBsaWNhYmxlVG8gYXMgaWYgaXQgd2VyZSBhbHJlYWR5IHJhcmVcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IHN1Y2Nlc3NcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbW9kczogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgdXBncmFkZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gdGhpcy5fc3VwZXIoaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW0ucmFyaXR5ICE9PSBJdGVtLlJBUklUWS5OT1JNQUwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IEFsY2hlbXkuQVBQTElDQUJMRV9CWVRFLk5PVF9XSElURTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQWxjaGVteS5BUFBMSUNBQkxFX0JZVEUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbGNoZW15LkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJBbGNoZW15LmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiT3JiIG9mIEFsY2hlbXlcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgQWxjaGVteS5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgLy8gQ3VycmVuY3lcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsXHJcbiAgICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgICBOT1RfQU5fSVRFTTogMixcclxuICAgICAgICAvLyBleHRlbmRlZFxyXG4gICAgICAgIE5PVF9XSElURTogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBBbGNoZW15O1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgVHJhbnNtdXRlID0gcmVxdWlyZSgnLi9UcmFuc211dGUnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIFxyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEF1Z21lbnQgZXh0ZW5kcyBDdXJyZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiByZXByZXNhbnRhdGlvbiBvZiBPcmIgb2YgQXVnbWVudGF0aW9uXHJcbiAgICAgKi9cclxuICAgIHZhciBBbHRlcmF0aW9uID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBbHRlcmF0aW9ufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChhbGxfbW9kcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihhbGxfbW9kcywgVHJhbnNtdXRlLm1vZF9maWx0ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLmtsYXNzID0gXCJBbHRlcmF0aW9uXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIG9uZSByYW5kb20gcHJvcGVydHlcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gQGxpbmsgSXRlbTo6YWRkTW9kXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHsgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gVE9ETyBhY3R1YWxseSBjb25zaWRlcnMgKl9jYW5ub3RfYmVfY2hhbmdlZD9cclxuICAgICAgICAgICAgICAgIC8vIGdyYW50ZWQgdmlhIHNjb3VyaW5nIGJ1dCBpcyB0aGlzIHRydWUgZm9yIGluZ2FtZSBhbHRzP1xyXG4gICAgICAgICAgICAgICAgbmV3IFNjb3VyaW5nKCkuYXBwbHlUbyhpdGVtKTtcclxuICAgICAgICAgICAgICAgIC8vIG5vIGNvbXBsZXRlIHNjb3VyP1xyXG4gICAgICAgICAgICAgICAgaWYgKCEobmV3IFRyYW5zbXV0ZSh0aGlzLmF2YWlsYWJsZV9tb2RzKS5hcHBseVRvKGl0ZW0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG5ldyBBdWdtZW50KHRoaXMuYXZhaWxhYmxlX21vZHMpLmFwcGx5VG8oaXRlbSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBpdGVtIG5lZWRzIHRvIGJlIG1hZ2ljXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Qnl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW0ucmFyaXR5ICE9PSBJdGVtLlJBUklUWS5NQUdJQykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQWx0ZXJhdGlvbi5BUFBMSUNBQkxFX0JZVEUuTk9UX01BR0lDO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQWx0ZXJhdGlvbi5BUFBMSUNBQkxFX0JZVEUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbHRlcmF0aW9uLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJBbHRlcmF0aW9uLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiT3JiIG9mIEFsdGVyYXRpb25cIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgQWx0ZXJhdGlvbi5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgLy8gQ3VycmVuY3lcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsXHJcbiAgICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgICBOT1RfQU5fSVRFTTogMixcclxuICAgICAgICAvLyBleHRlbmRlZFxyXG4gICAgICAgIE5PVF9NQUdJQzogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBBbHRlcmF0aW9uO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgVHJhbnNtdXRlID0gcmVxdWlyZSgnLi9UcmFuc211dGUnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIFxyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBBdWdtZW50IGV4dGVuZHMgQ3VycmVuY3lcclxuICAgICAqIFxyXG4gICAgICogcmVwcmVzYW50YXRpb24gb2YgT3JiIG9mIEF1Z21lbnRhdGlvblxyXG4gICAgICovXHJcbiAgICB2YXIgQXVnbWVudCA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXVnbWVudH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiQXVnbWVudFwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyBvbmUgcmFuZG9tIHByb3BlcnR5XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IEBsaW5rIEl0ZW06OmFkZE1vZFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChpdGVtKSB7IFxyXG4gICAgICAgICAgICBpZiAodGhpcy5hcHBsaWNhYmxlVG8oaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBpdGVtLmFkZE1vZCh0aGlzLmNob29zZU1vZChpdGVtKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGl0ZW0gbmVlZHMgdG8gYmUgbWFnaWNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtCeXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIFNVQ0NFU1MgYnl0ZVxyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSAmPSB+QXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChiYXNlaXRlbS5yYXJpdHkgIT09IEl0ZW0uUkFSSVRZLk1BR0lDKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBdWdtZW50LkFQUExJQ0FCTEVfQllURS5OT1RfTUFHSUM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5hcHBsaWNhYmxlX2J5dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBdWdtZW50LkFQUExJQ0FCTEVfQllURSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEF1Z21lbnQuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkF1Z21lbnQuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJPcmIgb2YgQXVnbWVudGF0aW9uXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEF1Z21lbnQuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfTUFHSUM6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gQXVnbWVudDtcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gcmVxdWlyZSgnLi9DdXJyZW5jeScpO1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IHJlcXVpcmUoJy4vVHJhbnNtdXRlJyk7XHJcbiAgICB2YXIgQWxjaGVteSA9IHJlcXVpcmUoJy4vQWxjaGVteScpO1xyXG4gICAgdmFyIFNjb3VyaW5nID0gcmVxdWlyZSgnLi9TY291cmluZycpO1xyXG4gICAgdmFyIEV4YWx0ZWQgPSByZXF1aXJlKCcuL0V4YWx0ZWQnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIFxyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIENoYW9zIGV4dGVuZHMgQ3VycmVuY3lcclxuICAgICAqIFxyXG4gICAgICogcmVwcmVzYW50YXRpb24gb2YgQ2hhb3MgT3JiXHJcbiAgICAgKi9cclxuICAgIHZhciBDaGFvcyA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7Q2hhb3N9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBUcmFuc211dGUubW9kX2ZpbHRlcik7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIkNoYW9zXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIG9uZSByYW5kb20gcHJvcGVydHlcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gQGxpbmsgSXRlbTo6YWRkTW9kXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHsgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gVE9ETyBhY3R1YWxseSBjb25zaWRlcnMgKl9jYW5ub3RfYmVfY2hhbmdlZD9cclxuICAgICAgICAgICAgICAgIC8vIGdyYW50ZWQgdmlhIHNjb3VyaW5nIGJ1dCBpcyB0aGlzIHRydWUgZm9yIGluZ2FtZSBhbHRzP1xyXG4gICAgICAgICAgICAgICAgbmV3IFNjb3VyaW5nKCkuYXBwbHlUbyhpdGVtKTtcclxuICAgICAgICAgICAgICAgIC8vIG5vIGNvbXBsZXRlIHNjb3VyP1xyXG4gICAgICAgICAgICAgICAgaWYgKCEobmV3IEFsY2hlbXkodGhpcy5hdmFpbGFibGVfbW9kcykuYXBwbHlUbyhpdGVtKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPIGNvcnJlbGF0ZSBjb3VudFxyXG4gICAgICAgICAgICAgICAgICAgIG5ldyBFeGFsdGVkKHRoaXMuYXZhaWxhYmxlX21vZHMpLmFwcGx5VG8oaXRlbSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBpdGVtIG5lZWRzIHRvIGJlIHJhcmVcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtCeXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIFNVQ0NFU1MgYnl0ZVxyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSAmPSB+QXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChiYXNlaXRlbS5yYXJpdHkgIT09IEl0ZW0uUkFSSVRZLlJBUkUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IENoYW9zLkFQUExJQ0FCTEVfQllURS5OT1RfUkFSRTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENoYW9zLkFQUExJQ0FCTEVfQllURSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIENoYW9zLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJDaGFvcy5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIkNoYW9zIE9yYlwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBDaGFvcy5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgLy8gQ3VycmVuY3lcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsXHJcbiAgICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgICBOT1RfQU5fSVRFTTogMixcclxuICAgICAgICAvLyBleHRlbmRlZFxyXG4gICAgICAgIE5PVF9SQVJFOiA0XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IENoYW9zO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9Nb2RHZW5lcmF0b3InKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgdmFyIFJvbGxhYmxlTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Sb2xsYWJsZU1vZCcpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIFxyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGFic3RyYWN0IGNsYXNzIEN1cnJlbmN5IGV4dGVuZHMgTW9kR2VuZXJhdG9yXHJcbiAgICAgKiBcclxuICAgICAqIGFic3RyYWN0IHJlcHJlc2VudGF0aW9uIG9mIGluZ2FtZSBjdXJyZW5jeSB3aGljaCBvbmx5IGFjY2VwdHNcclxuICAgICAqIHByZWZpeGVzLCBzdWZmaXhlcyBhbmQgaW1wbGljaXRzXHJcbiAgICAgKi9cclxuICAgIHZhciBDdXJyZW5jeSA9IE1vZEdlbmVyYXRvci5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gYW5kX2ZpbHRlciBhZGRpdGlvbmFsIGZpbHRlciBmdW5jdGlvbiBmb3IgJC5tYXBcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kR2VuZXJhdG9yfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChhbGxfbW9kcywgYW5kX2ZpbHRlcikge1xyXG4gICAgICAgICAgICBpZiAoYW5kX2ZpbHRlciA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIC8vIGR1bW15IGZpbHRlclxyXG4gICAgICAgICAgICAgICAgYW5kX2ZpbHRlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRydWU7IH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBSb2xsYWJsZU1vZCwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5TcGF3bldlaWdodF9UYWdzS2V5cyAhPT0gXCJcIiAmJiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgYW5kX2ZpbHRlcihtb2QpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kQ29udGFpbmVyfSBtb2RfY29udGFpbmVyXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWFwcyBNb2Q6OmFwcGxpY2FibGVUbyBhbmQgTW9kOjpzcGF3bmFibGVPbiB0byBhbGwgYXZhaWxhYmxlIG1vZHNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1hcDogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgcmV0dXJuICQubWFwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICBtb2QuYXBwbGljYWJsZVRvKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdyZXBzIE1vZDo6YXBwbGljYWJsZVRvIGFuZCBNb2Q6OnNwYXduYWJsZU9uIHRvIGFsbCBhdmFpbGFibGUgbW9kc1xyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2Vzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtb2RzOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICByZXR1cm4gJC5ncmVwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLmFwcGxpY2FibGVUbyhpdGVtLCBzdWNjZXNzKSAmJiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKGl0ZW0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGN1cnJlbmN5IG9ubHkgYXBwbGllcyB0byBpdGVtc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kQ29udGFpbmVyfSBtb2RfY29udGFpbmVyXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIsIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5yZXNldEFwcGxpY2FibGUoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIShtb2RfY29udGFpbmVyIGluc3RhbmNlb2YgSXRlbSkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IEN1cnJlbmN5LkFQUExJQ0FCTEVfQllURS5OT1RfQU5fSVRFTTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc2V0cyB0aGUgY2xhc3MgYmFjayB0byB1bnNjYW5uZWRcclxuICAgICAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICByZXNldEFwcGxpY2FibGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlVOU0NBTk5FRDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgQ3VycmVuY3kuQVBQTElDQUJMRV9CWVRFLCBDdXJyZW5jeS5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKlxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCeXRlU2V0Lmh1bWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgQXBwbGljYWJsZS5TVUNDRVNTKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiQWJzdHJhY3RDdXJyZW5jeVwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBDdXJyZW5jeS5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgLy8gQ29udmVudGlvbiBvZiBBcHBsaWNhYmxlXHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgLy8gQ3VycmVuY3lcclxuICAgICAgICBOT1RfQU5fSVRFTTogMlxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBDdXJyZW5jeTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XG4gICAgdmFyIE1vZEdlbmVyYXRvciA9IHJlcXVpcmUoJy4vTW9kR2VuZXJhdG9yJyk7XG4gICAgdmFyIE1vZCA9IHJlcXVpcmUoJy4uL21vZHMvTW9kJyk7XG4gICAgdmFyIFJvbGxhYmxlTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Sb2xsYWJsZU1vZCcpO1xuICAgIFxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XG4gICAgXG4gICAgLyoqXG4gICAgICogY2xhc3MgRW5jaGFudG1lbnRCZW5jaCBleHRlbmRzIE1vZEdlbmVyYXRvclxuICAgICAqIFxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBhIGVuY2hhbnRtZW50IGJlbmNoXG4gICAgICovXG4gICAgdmFyIEVuY2hhbnRtZW50YmVuY2ggPSBNb2RHZW5lcmF0b3IuZXh0ZW5kKHtcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzLCBhbmRfZmlsdGVyKSB7XG4gICAgICAgICAgICBpZiAoYW5kX2ZpbHRlciA9PT0gX191bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAvLyBkdW1teSBmaWx0ZXJcbiAgICAgICAgICAgICAgICBhbmRfZmlsdGVyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdHJ1ZTsgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFJvbGxhYmxlTW9kLCBmdW5jdGlvbiAobW9kKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5TcGF3bldlaWdodF9UYWdzS2V5cyAhPT0gXCJcIiAmJiBcbiAgICAgICAgICAgICAgICAgICAgICAgIEVuY2hhbnRtZW50YmVuY2gubW9kX2ZpbHRlcihtb2QpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0sXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBldmVyeSBpdGVtIGlzIHdlbGNvbWVcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgICAgICAgKi9cbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoaXRlbSkge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH0sXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3RyaW5nczogW10sXG4gICAgICAgICAgICAgICAgYml0czogW11cbiAgICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAnRW5jaGFudG1lbnRiZW5jaCc7XG4gICAgICAgIH0sXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xuICAgICAgICAgICAgcmV0dXJuICQuZ3JlcCh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBtb2QuYXBwbGljYWJsZVRvKGJhc2VpdGVtLCBzdWNjZXNzKSAmJiBcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZC5zcGF3bmFibGVPbihiYXNlaXRlbSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcbiAgICAgICAgICAgIHJldHVybiAkLm1hcCh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xuICAgICAgICAgICAgICAgIG1vZC5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xuICAgICAgICAgICAgICAgIG1vZC5zcGF3bmFibGVPbihiYXNlaXRlbSk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgRW5jaGFudG1lbnRiZW5jaC5tb2RfZmlsdGVyID0gZnVuY3Rpb24gKG1vZF9wcm9wcykge1xuICAgICAgICAvLyB0YWxpc21hbiB3aWxkY2FyZFxuICAgICAgICByZXR1cm4gW01vZC5NT0RfVFlQRS5FTkNIQU5UTUVOVF0uaW5kZXhPZigrbW9kX3Byb3BzLkdlbmVyYXRpb25UeXBlKSAhPT0gLTE7XG4gICAgfTtcbiAgICBcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEVuY2hhbnRtZW50YmVuY2g7XG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgVHJhbnNtdXRlID0gcmVxdWlyZSgnLi9UcmFuc211dGUnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIFxyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEV4YWx0ZWQgZXh0ZW5kcyBDdXJyZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiBpbmdhbWUgcmVwcmVzZW50YXRpb24gb2YgRXhhbHRlZCBvcmJcclxuICAgICAqL1xyXG4gICAgdmFyIEV4YWx0ZWQgPSBDdXJyZW5jeS5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge0V4YWx0ZWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBUcmFuc211dGUubW9kX2ZpbHRlcik7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIkV4YWx0ZWRcIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgb25lIHJhbmRvbSBwcm9wZXJ0eSB0byBhbiBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHsgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0uYWRkTW9kKHRoaXMuY2hvb3NlTW9kKGl0ZW0pKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBvbmx5IGFwcGxpY2FibGUgdG8gcmFyZSBpdGVtc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgU1VDQ0VTUyBieXRlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlICY9IH5BcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtLnJhcml0eSAhPT0gSXRlbS5SQVJJVFkuUkFSRSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gRXhhbHRlZC5BUFBMSUNBQkxFX0JZVEUuTk9UX1JBUkU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5hcHBsaWNhYmxlX2J5dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCeXRlU2V0Lmh1bWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBFeGFsdGVkLkFQUExJQ0FCTEVfQllURSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEV4YWx0ZWQuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkV4YWx0ZWQuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJFeGFsdGVkIE9yYlwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBFeGFsdGVkLkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBDdXJyZW5jeVxyXG4gICAgICAgIFVOU0NBTk5FRDogMCxcclxuICAgICAgICBTVUNDRVNTOiAxLFxyXG4gICAgICAgIE5PVF9BTl9JVEVNOiAyLFxyXG4gICAgICAgIC8vIGV4dGVuZGVkXHJcbiAgICAgICAgTk9UX1JBUkU6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gRXhhbHRlZDtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9Nb2RHZW5lcmF0b3InKTtcclxuICAgIHZhciBUcmFuc211dGUgPSByZXF1aXJlKCcuL1RyYW5zbXV0ZScpO1xyXG4gICAgdmFyIFZhYWwgPSByZXF1aXJlKCcuL1ZhYWwnKTtcclxuICAgIHZhciBUYWxpc21hbiA9IHJlcXVpcmUoJy4vVGFsaXNtYW4nKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIHZhciBBcHBsaWNhYmxlTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9BcHBsaWNhYmxlTW9kJyk7XHJcbiAgICB2YXIgUm9sbGFibGVNb2QgPSByZXF1aXJlKCcuLi9tb2RzL1JvbGxhYmxlTW9kJyk7XHJcbiAgICB2YXIgTWFzdGVyTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9NYXN0ZXJNb2QnKTtcclxuICAgIHZhciBTcGF3bmFibGUgPSByZXF1aXJlKCcuLi9TcGF3bmFibGUnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBJdGVtU2hvd2Nhc2UgZXh0ZW5kcyBNb2RHZW5lcmF0b3JcclxuICAgICAqIFxyXG4gICAgICogTWFzdGVyYmVuY2gvQ3VycmVuY3kgaHlicmlkXHJcbiAgICAgKi9cclxuICAgIHZhciBJdGVtU2hvd2Nhc2UgPSBNb2RHZW5lcmF0b3IuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtJdGVtU2hvd2Nhc2V9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gJC5tYXAoYWxsX21vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIC8vIHRyYW5zbXV0ZS92YWFsIG1vZHNcclxuICAgICAgICAgICAgICAgIGlmICghVHJhbnNtdXRlLm1vZF9maWx0ZXIobW9kKSAmJiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgIVZhYWwubW9kX2ZpbHRlcihtb2QpICYmXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICFUYWxpc21hbi5tb2RfZmlsdGVyKG1vZCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKCttb2QuR2VuZXJhdGlvblR5cGUgPT09IE1vZC5NT0RfVFlQRS5UQUxJU01BTikge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgQXBwbGljYWJsZU1vZChtb2QpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoK21vZC5Eb21haW4gPT09IE1vZC5ET01BSU4uTUFTVEVSKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gbWFzdGVybW9kPyA9PiBsb29rIGZvciBjcmFmdGluZ2JlbmNoXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNyYWZ0aW5nYmVuY2hvcHRpb24gPSAkLm1hcChNYXN0ZXJNb2QuY3JhZnRpbmdiZW5jaG9wdGlvbnMsIGZ1bmN0aW9uIChvcHRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCtvcHRpb24uTW9kc0tleSA9PT0gK21vZC5Sb3dzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9uO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghY3JhZnRpbmdiZW5jaG9wdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtb3N0IGxpa2VseSBsZWdhY3lcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhcImNvdWxkIG5vdCBmaW5kIGNyYWZ0aW5nYmVuY2hvcHRpb24gZm9yIFwiLCArbW9kWydSb3dzJ10sIG1vZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE1hc3Rlck1vZChtb2QsIGNyYWZ0aW5nYmVuY2hvcHRpb24pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBzcGF3bmFibGU/XHJcbiAgICAgICAgICAgICAgICBpZiAobW9kLlNwYXduV2VpZ2h0X1RhZ3NLZXlzICE9PSBcIlwiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBSb2xsYWJsZU1vZChtb2QpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihtb2RzLCBBcHBsaWNhYmxlTW9kKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2codGhpcy5nZXRBdmFpbGFibGVNb2RzKCkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogb25seSBhYnN0cmFjdCBzaG93Y2FzZSwgbm90IGZvciBhY3R1YWwgdXNhZ2VcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge01vZENvbnRhaW5lcn0gbW9kX2NvbnRhaW5lclxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG1hcHMgbW9kOjphcHBsaWNhYmxlVG8gYW5kIChpZiBpbXBsZW1lbnRlZCkgbW9kOjpzcGF3bmFibGVPbiBcclxuICAgICAgICAgKiBpZiB3ZSBoYXZlIGFsbCB0aGUgc3BhY2UgZm9yIG1vZHMgd2UgbmVlZFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1hcDogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIC8vIHNpbXVsYXRlIHNob3djYXNlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gYmFzZWl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5TSE9XQ0FTRTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gJC5tYXAodGhpcy5nZXRBdmFpbGFibGVNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIG1vZC5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIG1vZC5zcGF3bmFibGVPbihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIHZhYWxzIHJlcGxhY2Ugc28gd2UgZG9udCBjYXJlIGFib3V0IGZ1bGwgb3Igbm90XHJcbiAgICAgICAgICAgICAgICBpZiAobW9kLmlzVHlwZShcInZhYWxcIikgJiYgbW9kLmFwcGxpY2FibGVfYnl0ZSAmIEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkRPTUFJTl9GVUxMKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbW9kLmFwcGxpY2FibGVfYnl0ZSBePSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5ET01BSU5fRlVMTDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdyZXBzIG1vZDo6YXBwbGljYWJsZVRvIGFuZCAoaWYgaW1wbGVtZW50ZWQpIG1vZDo6c3Bhd25hYmxlT24gXHJcbiAgICAgICAgICogaWYgd2UgaGF2ZSBhbGwgdGhlIHNwYWNlIGZvciBtb2RzIHdlIG5lZWRcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtb2RzOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgc2hvd2Nhc2VcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBiYXNlaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlNIT1dDQVNFO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSAkLm1hcCh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG1vZC5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0sIHN1Y2Nlc3MpICYmIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAoIVNwYXduYWJsZS5pbXBsZW1lbnRlZEJ5KG1vZCkgfHwgbW9kLnNwYXduYWJsZU9uKGJhc2VpdGVtKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyB2YWFscyByZXBsYWNlIHNvIHdlIGRvbnQgY2FyZSBhYm91dCBmdWxsIG9yIG5vdFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChtb2QuaXNUeXBlKFwidmFhbFwiKSAmJiBtb2QuYXBwbGljYWJsZV9ieXRlICYgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuRE9NQUlOX0ZVTEwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kLmFwcGxpY2FibGVfYnl0ZSBePSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5ET01BSU5fRlVMTDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1vZDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJJdGVtIFNob3djYXNlXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gSXRlbVNob3djYXNlO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBNb2RHZW5lcmF0b3IgPSByZXF1aXJlKCcuL01vZEdlbmVyYXRvcicpO1xyXG4gICAgdmFyIE1hc3Rlck1vZCA9IHJlcXVpcmUoJy4uL21vZHMvTWFzdGVyTW9kJyk7XHJcbiAgICB2YXIgSXRlbSA9IHJlcXVpcmUoJy4uL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgXHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIE1hc3RlcmJlbmNoIGV4dGVuZHMgTW9kR2VuZXJhdG9yXHJcbiAgICAgKiBcclxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBhIENyYWZ0aW5nYmVuY2hcclxuICAgICAqL1xyXG4gICAgdmFyIE1hc3RlcmJlbmNoID0gTW9kR2VuZXJhdG9yLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogTWFzdGVyTW9kLmNyYWZ0aW5nYmVuY2hvcHRpb25zIG5lZWRzIHRvIGJlIGluaXRpYWxpemVkXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbnBjX21hc3Rlcl9rZXkgTlBDTWFzdGVyS2V5IGNvbHVtblxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNYXN0ZXJiZW5jaH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMsIG5wY19tYXN0ZXJfa2V5KSB7XHJcbiAgICAgICAgICAgIC8vIGFsbCBvcHRpb25zXHJcbiAgICAgICAgICAgIC8vIGNyYWZ0aW5nYmVuY2hvcHRpb25zIGluc3RhbmNlb2Yge30gc28gd2UgY2FudCB1c2UgZ3JlcFxyXG4gICAgICAgICAgICB0aGlzLmNyYWZ0aW5nYmVuY2hvcHRpb25zID0gJC5tYXAoTWFzdGVyTW9kLmNyYWZ0aW5nYmVuY2hvcHRpb25zLCBmdW5jdGlvbiAob3B0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoK29wdGlvbi5OUENNYXN0ZXJLZXkgPT09IG5wY19tYXN0ZXJfa2V5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGluaXQgbW9kc1xyXG4gICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgKiB8bW9kc3wgPj4gfGNyYWZ0aW5nYmVuY2hvcHRpb25zfCBzbyB3ZSBsb29wIHRocm91Z2hcclxuICAgICAgICAgICAgICogbW9kcyBhbmQgZ3JlcCBvcHRpb25zIGluc3RlYWQgb2YgbG9vcGluZyB0aHJvdWdoIG9wdGlvbnMgXHJcbiAgICAgICAgICAgICAqIGFuZCBncmVwIG1vZFxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcigkLm1hcChhbGxfbW9kcywgZnVuY3Rpb24gKG1vZF9wcm9wcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCttb2RfcHJvcHMuRG9tYWluID09PSBNb2QuRE9NQUlOLk1BU1RFUikge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIG1hc3Rlcm1vZD8gPT4gbG9vayBmb3IgY3JhZnRpbmdiZW5jaFxyXG4gICAgICAgICAgICAgICAgICAgIHZhciBjcmFmdGluZ2JlbmNob3B0aW9uID0gJC5ncmVwKHRoYXQuY3JhZnRpbmdiZW5jaG9wdGlvbnMsIGZ1bmN0aW9uIChvcHRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICtvcHRpb24uTW9kc0tleSA9PT0gK21vZF9wcm9wcy5Sb3dzO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghY3JhZnRpbmdiZW5jaG9wdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtb3N0IGxpa2VseSBsZWdhY3lcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhcImNvdWxkIG5vdCBmaW5kIGNyYWZ0aW5nYmVuY2hvcHRpb24gZm9yIFwiLCArbW9kWydSb3dzJ10sIG1vZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IE1hc3Rlck1vZChtb2RfcHJvcHMsIGNyYWZ0aW5nYmVuY2hvcHRpb24pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfSksIE1hc3Rlck1vZCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBwb3NzaWJsZSBpbnRlcmZhY2UgYmV0d2VlbiBndWkgYW5kIGNsYXNzXHJcbiAgICAgICAgICAgIHRoaXMuY2hvc2VuX21vZCA9IG51bGw7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhcHBsaWVzIGEgY2hvc2VuIGNyYWZ0aW5nYmVuY2hvcHRpb25cclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IG9wdGlvbl9pbmRleCBvcHRpb25faW5kZXggd2l0aGluIHRoaXMuY3JhZnRpbmdiZW5jaG9wdGlvbnNcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIG9wdGlvbl9pbmRleCkge1xyXG4gICAgICAgICAgICB2YXIgbW9kLCBvbGRfcmFyaXR5O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gb3B0aW9uIHdpdGhpbiBvcHRpb25zXHJcbiAgICAgICAgICAgIHZhciBvcHRpb24gPSB0aGlzLmNyYWZ0aW5nYmVuY2hvcHRpb25zW29wdGlvbl9pbmRleF07XHJcbiAgICAgICAgICAgIGlmIChvcHRpb24gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIG1vZCA9ICQuZ3JlcCh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuICttb2QuZ2V0UHJvcChcIlJvd3NcIikgPT09ICtvcHRpb24uTW9kc0tleTtcclxuICAgICAgICAgICAgfSlbMF07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyB2YWxpZCBtb2Q/XHJcbiAgICAgICAgICAgIGlmICghKG1vZCBpbnN0YW5jZW9mIE1hc3Rlck1vZCkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKG1vZCwgXCJuZWVkcyB0byBiZSBpbnN0YW5jZW9mIE1hc3Rlck1vZFwiKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gd2hpdGUgZ2V0cyB1cGdyYWRlZCB0byBibHVlXHJcbiAgICAgICAgICAgIG9sZF9yYXJpdHkgPSBiYXNlaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGlmIChvbGRfcmFyaXR5ID09PSBJdGVtLlJBUklUWS5OT1JNQUwpIHtcclxuICAgICAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk1BR0lDO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBtb2QgYXBwbGljYWJsZVxyXG4gICAgICAgICAgICBpZiAobW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBiYXNlaXRlbS5hZGRNb2QobW9kKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmV0dXJuIHRvIG9sZCByYXJpdHkgb24gZmFpbHVyZVxyXG4gICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZXZlcnkgaXRlbSBpcyB3ZWxjb21lXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN0cmluZ3M6IFtdLFxyXG4gICAgICAgICAgICAgICAgYml0czogW11cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdyZXBzIG1vZDo6YXBwbGljYWJsZVRvIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSBibHVlIGlmIHdoaXRlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gYmFzZWl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpZiAob2xkX3Jhcml0eSA9PT0gSXRlbS5SQVJJVFkuTk9STUFMKSB7XHJcbiAgICAgICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5NQUdJQztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSAkLmdyZXAodGhpcy5nZXRBdmFpbGFibGVNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2QuYXBwbGljYWJsZVRvKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZXJvbGxcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ3JlcHMgbW9kOjphcHBsaWNhYmxlVG9cclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXA6IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSBibHVlIGlmIHdoaXRlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gYmFzZWl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpZiAob2xkX3Jhcml0eSA9PT0gSXRlbS5SQVJJVFkuTk9STUFMKSB7XHJcbiAgICAgICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5NQUdJQztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSAkLm1hcCh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgbW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHJlcm9sbFxyXG4gICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNyYWZ0aW5nYmVuY2hvcHRpb25zWzBdLk1hc3Rlck5hbWVTaG9ydDtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNYXN0ZXJiZW5jaDtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICBcclxuICAgIGlmICgkID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qXHJcbiAgICAgKiBhYnN0cmFjdCBDbGFzcyBNb2RHZW5lcmF0b3IgaW1wbGVtZW50cyBBcHBsaWNhYmxlXHJcbiAgICAgKi9cclxuICAgIHZhciBNb2RHZW5lcmF0b3IgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXlbbW9kc119IG1vZF9jb2xsZWN0aW9uXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IG1vZF9rbGFzc1xyXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGZpbHRlciBmaWx0ZXIgZm9yIG1vZF9wcm9wc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2RHZW5lcmF0b3J9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKG1vZF9jb2xsZWN0aW9uLCBtb2Rfa2xhc3MsIGZpbHRlcikge1xyXG4gICAgICAgICAgICB0aGlzLnVzZXMgPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoZmlsdGVyID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgLy8gZHVtbXkgZmlsdGVyXHJcbiAgICAgICAgICAgICAgICBmaWx0ZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0cnVlOyB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBhbHJlYWR5IGZpbHRlcmVkP1xyXG4gICAgICAgICAgICBpZiAobW9kX2NvbGxlY3Rpb25bMF0gaW5zdGFuY2VvZiBtb2Rfa2xhc3MpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlX21vZHMgPSBtb2RfY29sbGVjdGlvbjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXZhaWxhYmxlX21vZHMgPSAkLm1hcChtb2RfY29sbGVjdGlvbiwgZnVuY3Rpb24gKG1vZF9wcm9wcykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChmaWx0ZXIobW9kX3Byb3BzKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IG1vZF9rbGFzcyhtb2RfcHJvcHMpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBBcHBsaWNhYmxlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5VTlNDQU5ORUQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhYnN0cmFjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kQ29udGFpbmVyfSBtb2RfY29udGFpbmVyXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXlbTW9kXX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRBdmFpbGFibGVNb2RzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmF2YWlsYWJsZV9tb2RzLnNsaWNlKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtb2RzOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lciwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRBdmFpbGFibGVNb2RzKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtYXA6IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldEF2YWlsYWJsZU1vZHMoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFic3RyYWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtNb2RDb250YWluZXJ9IG1vZF9jb250YWluZXJcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc2V0QXBwbGljYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWJzdHJhY3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdhYnN0cmFjdCc7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQ2FjaGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFwcGxpY2FibGVfYnl0ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNob29zZU1vZDogZnVuY3Rpb24gKGJhc2VpdGVtKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbW9kcyA9IHRoaXMubW9kcyhiYXNlaXRlbSk7XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFRPRE8gc3Bhd253ZWlnaHRcclxuICAgICAgICAgICAgcmV0dXJuIG1vZHNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogKG1vZHMubGVuZ3RoIC0gMSkpXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiQWJzdHJhY3RNb2RHZW5lcmF0b3JcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTsgXHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTW9kR2VuZXJhdG9yO1xyXG59KS5jYWxsKHRoaXMpO1xyXG5cclxuIiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi4vSW5oZXJpdGFuY2UnKTtcclxuICAgIHZhciBUcmFuc211dGUgPSByZXF1aXJlKCcuL1RyYW5zbXV0ZScpO1xyXG4gICAgdmFyIEF1Z21lbnQgPSByZXF1aXJlKCcuL0F1Z21lbnQnKTtcclxuICAgIHZhciBBbHRlcmF0aW9uID0gcmVxdWlyZSgnLi9BbHRlcmF0aW9uJyk7XHJcbiAgICB2YXIgU2NvdXJpbmcgPSByZXF1aXJlKCcuL1Njb3VyaW5nJyk7XHJcbiAgICB2YXIgUmVnYWwgPSByZXF1aXJlKCcuL1JlZ2FsJyk7XHJcbiAgICB2YXIgQWxjaGVteSA9IHJlcXVpcmUoJy4vQWxjaGVteScpO1xyXG4gICAgdmFyIENoYW9zID0gcmVxdWlyZSgnLi9DaGFvcycpO1xyXG4gICAgdmFyIEV4YWx0ZWQgPSByZXF1aXJlKCcuL0V4YWx0ZWQnKTtcclxuICAgIHZhciBJdGVtU2hvd2Nhc2UgPSByZXF1aXJlKCcuL0l0ZW1TaG93Y2FzZScpO1xyXG4gICAgdmFyIEVuY2hhbnRtZW50YmVuY2ggPSByZXF1aXJlKCcuL0VuY2hhbnRtZW50YmVuY2gnKTtcclxuICAgIFxyXG4gICAgdmFyIE1vZEdlbmVyYXRvckZhY3RvcnkgPSBDbGFzcy5leHRlbmQoe30pO1xyXG4gICAgXHJcbiAgICBNb2RHZW5lcmF0b3JGYWN0b3J5LmJ1aWxkID0gZnVuY3Rpb24gKGlkZW50LCBhbGxfbW9kcykge1xyXG4gICAgICAgIHZhciBnZW5lcmF0b3IgPSBNb2RHZW5lcmF0b3JGYWN0b3J5LkdFTkVSQVRPUlNbaWRlbnRdO1xyXG4gICAgICAgIGlmICghZ2VuZXJhdG9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY291bGQgbm90IGlkZW50aWZ5IFwiLCBpZGVudCk7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbmV3IGdlbmVyYXRvci5jb25zdHJ1Y3RvcihhbGxfbW9kcyk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBNb2RHZW5lcmF0b3JGYWN0b3J5LkdFTkVSQVRPUlMgPSB7XHJcbiAgICAgICAgVFJBTlNNVVRFOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIlRyYW5zbXV0ZVwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIk9yYiBvZiBUcmFuc211dGF0aW9uXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkN1cnJlbmN5XCIsXHJcbiAgICAgICAgICAgICAgICBcIlVwZ3JhZGVzIGEgbm9ybWFsIGl0ZW0gdG8gYSBtYWdpYyBpdGVtXCIsXHJcbiAgICAgICAgICAgICAgICBcIlJpZ2h0IGNsaWNrIHRoaXMgaXRlbSB0aGVuIGxlZnQgY2xpY2sgYSBub3JtYWwgaXRlbSB0byBhcHBseVwiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBUcmFuc211dGVcclxuICAgICAgICB9LFxyXG4gICAgICAgIEFVR01FTlQ6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiQXVnbWVudFwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIk9yYiBvZiBBdWdtZW50YXRpb25cIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3VycmVuY3lcIixcclxuICAgICAgICAgICAgICAgIFwiRW5jaGFudHMgYSBtYWdpYyBpdGVtIHdpdGggYSBuZXcgcmFuZG9tIHByb3BlcnR5XCIsXHJcbiAgICAgICAgICAgICAgICBcIlJpZ2h0IGNsaWNrIHRoaXMgaXRlbSB0aGVuIGxlZnQgY2xpY2sgYSBub3JtYWwgaXRlbSB0byBhcHBseVwiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBBdWdtZW50XHJcbiAgICAgICAgfSxcclxuICAgICAgICBBTFRFUkFUSU9OOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIkFsdGVyYXRpb25cIixcclxuICAgICAgICAgICAgbmFtZTogXCJPcmIgb2YgQWx0ZXJhdGlvblwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDdXJyZW5jeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSZWZvcmdlcyBhIG1hZ2ljIGl0ZW0gd2l0aCBuZXcgcmFuZG9tIHByb3BlcnRpZXNcIixcclxuICAgICAgICAgICAgICAgIFwiUmlnaHQgY2xpY2sgdGhpcyBpdGVtIHRoZW4gbGVmdCBjbGljayBhIG5vcm1hbCBpdGVtIHRvIGFwcGx5XCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IEFsdGVyYXRpb25cclxuICAgICAgICB9LFxyXG4gICAgICAgIFNDT1VSSU5HOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIlNjb3VyaW5nXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiT3JiIG9mIFNjb3VyaW5nXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkN1cnJlbmN5XCIsXHJcbiAgICAgICAgICAgICAgICBcIlJlbW92ZXMgYWxsIHByb3BlcnRpZXMgZnJvbSBhbiBpdGVtXCIsXHJcbiAgICAgICAgICAgICAgICBcIlJpZ2h0IGNsaWNrIHRoaXMgaXRlbSB0aGVuIGxlZnQgY2xpY2sgYSBub3JtYWwgaXRlbSB0byBhcHBseVwiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBTY291cmluZ1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgUkVHQUw6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiUmVnYWxcIixcclxuICAgICAgICAgICAgbmFtZTogXCJSZWdhbCBPcmJcIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3VycmVuY3lcIixcclxuICAgICAgICAgICAgICAgIFwiVXBncmFkZXMgYSBtYWdpYyBpdGVtIHRvIGEgcmFyZSBpdGVtXCIsXHJcbiAgICAgICAgICAgICAgICBcIlJpZ2h0IGNsaWNrIHRoaXMgaXRlbSB0aGVuIGxlZnQgY2xpY2sgYSBtYWdpYyBpdGVtIHRvIGFwcGx5IGl0LiBDdXJyZW50IHByb3BlcnRpZXMgYXJlIHJldGFpbmVkIGFuZCBhIG5ldyBvbmUgaXMgYWRkZWQuXCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IFJlZ2FsXHJcbiAgICAgICAgfSxcclxuICAgICAgICBBTENIRU1ZOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIkFsY2hlbXlcIixcclxuICAgICAgICAgICAgbmFtZTogXCJPcmIgb2YgQWxjaGVteVwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDdXJyZW5jeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJVcGdyYWRlcyBhIG5vcm1hbCBpdGVtIHRvIHJhcmUgaXRlbVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSaWdodCBjbGljayB0aGlzIGl0ZW0gdGhlbiBsZWZ0IGNsaWNrIGEgbWFnaWMgaXRlbSB0byBhcHBseSBpdC4gQ3VycmVudCBwcm9wZXJ0aWVzIGFyZSByZXRhaW5lZCBhbmQgYSBuZXcgb25lIGlzIGFkZGVkLlwiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBBbGNoZW15XHJcbiAgICAgICAgfSxcclxuICAgICAgICBDSEFPUzoge1xyXG4gICAgICAgICAgICBrbGFzczogXCJDaGFvc1wiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIkNoYW9zIE9yYlwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDdXJyZW5jeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJVcGdyYWRlcyBhIG1hZ2ljIGl0ZW0gdG8gYSByYXJlIGl0ZW1cIixcclxuICAgICAgICAgICAgICAgIFwiUmlnaHQgY2xpY2sgdGhpcyBpdGVtIHRoZW4gbGVmdCBjbGljayBhIG1hZ2ljIGl0ZW0gdG8gYXBwbHkgaXQuIEN1cnJlbnQgcHJvcGVydGllcyBhcmUgcmV0YWluZWQgYW5kIGEgbmV3IG9uZSBpcyBhZGRlZC5cIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogQ2hhb3NcclxuICAgICAgICB9LFxyXG4gICAgICAgIEVYQUxURUQ6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiRXhhbHRlZFwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIkV4YWx0ZWQgT3JiXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkN1cnJlbmN5XCIsXHJcbiAgICAgICAgICAgICAgICBcIkVuY2hhbnRzIGEgcmFyZSBpdGVtIHdpdGggYSBuZXcgcmFuZG9tIHByb3BlcnR5XCIsXHJcbiAgICAgICAgICAgICAgICBcIlJpZ2h0IGNsaWNrIHRoaXMgaXRlbSB0aGVuIGxlZnQgY2xpY2sgYSByYXJlIGl0ZW0gdG8gYXBwbHkgaXQuIFJhcmUgaXRlbXMgY2FuIGhhdmUgdXAgdG8gc2l4IHJhbmRvbSBwcm9wZXJ0aWVzLlwiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBFeGFsdGVkXHJcbiAgICAgICAgfSxcclxuICAgICAgICBJVEVNU0hPV0NBU0U6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiSXRlbVNob3djYXNlXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiU2hvd2Nhc2VcIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQWxsIE1vZHNcIixcclxuICAgICAgICAgICAgICAgIFwic2hvd3MgYWxsIHBvc3NpYmxlIG1vZHNcIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogSXRlbVNob3djYXNlXHJcbiAgICAgICAgfSxcclxuICAgICAgICBFTkNIQU5UTUVOVEJFTkNIOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIkVuY2hhbnRtZW50YmVuY2hcIixcclxuICAgICAgICAgICAgbmFtZTogXCJFbmNoYW50bWVudGJlbmNoXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkNyYWZ0aW5nYmVuY2hcIixcclxuICAgICAgICAgICAgICAgIFwiY3JhZnRzIGltcGxpY2l0IGVuY2hhbnRtZW50c1wiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBFbmNoYW50bWVudGJlbmNoXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNb2RHZW5lcmF0b3JGYWN0b3J5O1xyXG59KS5jYWxsKHRoaXMpO1xyXG5cclxuIiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDdXJyZW5jeSA9IHJlcXVpcmUoJy4vQ3VycmVuY3knKTtcclxuICAgIHZhciBUcmFuc211dGUgPSByZXF1aXJlKCcuL1RyYW5zbXV0ZScpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgUmVnYWwgZXh0cmVuZHMgQGxpbmsgQ3VycmVuY3lcclxuICAgICAqIFxyXG4gICAgICogaW5nYW1lIHJlcHJlc2VudGF0aW9uIG9mIFJlZ2FsIE9yYlxyXG4gICAgICovXHJcbiAgICB2YXIgUmVnYWwgPSBDdXJyZW5jeS5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge1JlZ2FsfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChhbGxfbW9kcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihhbGxfbW9kcywgVHJhbnNtdXRlLm1vZF9maWx0ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLmtsYXNzID0gXCJSZWdhbFwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyBvbmUgcmFuZG9tIHByb3AgYW5kIHVwZ3JhZGVzIHRvIHJhcmVcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5hcHBsaWNhYmxlVG8oaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgIC8vIHVwZ3JhZGUgdG8gcmFyZVxyXG4gICAgICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5SQVJFO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBpdGVtLmFkZE1vZCh0aGlzLmNob29zZU1vZChpdGVtKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWFwcyBtb2Q6OmFwcGxpY2FibGVUbyBhcyBpZiBpdCB3ZXJlIGFscmVhZHkgcmFyZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSB1cGdyYWRlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuUkFSRTtcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSB0aGlzLl9zdXBlcihpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBncmVwcyBtb2Q6OmFwcGxpY2FibGVUbyBhcyBpZiBpdCB3ZXJlIGFscmVhZHkgcmFyZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbW9kczogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgdXBncmFkZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gdGhpcy5fc3VwZXIoaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogb25seSBhcHBsaWNhYmxlIHRvIG1hZ2ljc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgU1VDQ0VTUyBieXRlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlICY9IH5BcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtLnJhcml0eSAhPT0gSXRlbS5SQVJJVFkuTUFHSUMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IFJlZ2FsLkFQUExJQ0FCTEVfQllURS5OT1RfTUFHSUM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5hcHBsaWNhYmxlX2J5dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlZ2FsLkFQUExJQ0FCTEVfQllURSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFJlZ2FsLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJSZWdhbC5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIlJlZ2FsIE9yYlwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBSZWdhbC5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgLy8gQ3VycmVuY3lcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsXHJcbiAgICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgICBOT1RfQU5fSVRFTTogMixcclxuICAgICAgICAvLyBleHRlbmRlZFxyXG4gICAgICAgIE5PVF9NQUdJQzogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBSZWdhbDtcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gcmVxdWlyZSgnLi9DdXJyZW5jeScpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBNYXN0ZXJNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01hc3Rlck1vZCcpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICBcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgU2NvdXJpbmcgZXh0ZW5kcyBAbGluayBDdXJyZW5jeVxyXG4gICAgICovXHJcbiAgICB2YXIgU2NvdXJpbmcgPSBDdXJyZW5jeS5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG5vIG1vZHMgbmVlZCBmb3IgU2NvdXJpbmcuIGl0IGRvZXMgdGhlIGV4YWN0IG9wcG9zaXRlIG9mIGdlbmVyYXRpbmcgbW9kc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTY291cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKFtdKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiU2NvdXJpbmdcIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFwcGxpZXMgT3JiIG9mIFNjb3VyaW5nIHRvIGFuIGl0ZW1cclxuICAgICAgICAgKiBjb25zaWRlcnMgbG9ja2VkIGFmZml4ZXMgbWV0YW1vZHNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBvbiBzdWNjZXNzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHsgXHJcbiAgICAgICAgICAgIHZhciBsb2NrZWRfcHJlZml4ZXMsIGxvY2tlZF9zdWZmaXhlcztcclxuICAgICAgICAgICAgdmFyIHJlbWFpbmluZ19wcmVmaXhlcywgcmVtYWluaW5nX3N1ZmZpeGVzO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICBsb2NrZWRfcHJlZml4ZXMgPSBpdGVtLmluTW9kcyhNYXN0ZXJNb2QuTUVUQU1PRC5MT0NLRURfUFJFRklYRVMpICE9PSAtMTtcclxuICAgICAgICAgICAgICAgIGxvY2tlZF9zdWZmaXhlcyA9IGl0ZW0uaW5Nb2RzKE1hc3Rlck1vZC5NRVRBTU9ELkxPQ0tFRF9TVUZGSVhFUykgIT09IC0xO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAkLmVhY2goaXRlbS5nZXRBZmZpeGVzKCksIGZ1bmN0aW9uIChfLCBtb2QpIHtcclxuICAgICAgICAgICAgICAgICAgICAgaWYgKG1vZC5pc1ByZWZpeCgpICYmICFsb2NrZWRfcHJlZml4ZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucmVtb3ZlTW9kKG1vZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobW9kLmlzU3VmZml4KCkgJiYgIWxvY2tlZF9zdWZmaXhlcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgaXRlbS5yZW1vdmVNb2QobW9kKTtcclxuICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIHNldCBjb3JyZWN0IHJhcml0eVxyXG4gICAgICAgICAgICAgICAgcmVtYWluaW5nX3ByZWZpeGVzID0gaXRlbS5nZXRQcmVmaXhlcygpLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIHJlbWFpbmluZ19zdWZmaXhlcyA9IGl0ZW0uZ2V0U3VmZml4ZXMoKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChyZW1haW5pbmdfcHJlZml4ZXMgPT09IDAgJiYgcmVtYWluaW5nX3N1ZmZpeGVzID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5OT1JNQUw7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlbWFpbmluZ19wcmVmaXhlcyA+IDEgfHwgcmVtYWluaW5nX3N1ZmZpeGVzID4gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuUkFSRTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5NQUdJQztcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBjaGVja3MgaWYgbm9ybWFsIG9yIHVuaXF1ZSByYXJpdHkgYW5kIHJldHVybnMgZmFsc2VcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBzdWNjZXNzIHdoaXRlbGlzdGVkIEBsaW5rIFNjb3VyaW5nLkFQUExJQ0FCTEVfQllURSB0aGF0IGlzIGNvbnNpZGVyZWQgYSBzdWNjZXNzXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIFNVQ0NFU1MgYnl0ZVxyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSAmPSB+QXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHN3aXRjaCAoYmFzZWl0ZW0ucmFyaXR5KSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLk5PUk1BTDpcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBTY291cmluZy5BUFBMSUNBQkxFX0JZVEUuQUxSRUFEWV9XSElURTtcclxuICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuVU5JUVVFOlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IFNjb3VyaW5nLkFQUExJQ0FCTEVfQllURS5VTklRVUU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5hcHBsaWNhYmxlX2J5dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCeXRlU2V0Lmh1bWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTY291cmluZy5BUFBMSUNBQkxFX0JZVEUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBTY291cmluZy5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiU2NvdXJpbmcuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJPcmIgb2YgU2NvdXJpbmdcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBmYWlsdXJlIGJpdHNcclxuICAgICAqL1xyXG4gICAgU2NvdXJpbmcuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBBTFJFQURZX1dISVRFOiA0LFxyXG4gICAgICAgIFVOSVFVRTogOFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBTY291cmluZztcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9Nb2RHZW5lcmF0b3InKTtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01vZCcpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIFRPRE9cclxuICAgICAqL1xyXG4gICAgdmFyIFRhbGlzbWFuID0gTW9kR2VuZXJhdG9yLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgVGFsaXNtYW4ubW9kX2ZpbHRlciA9IGZ1bmN0aW9uIChtb2RfcHJvcHMpIHtcclxuICAgICAgICAvLyB0YWxpc21hbiB3aWxkY2FyZFxyXG4gICAgICAgIHJldHVybiBbTW9kLk1PRF9UWVBFLkVOQ0hBTlRNRU5UXS5pbmRleE9mKCttb2RfcHJvcHMuR2VuZXJhdGlvblR5cGUpICE9PSAtMTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gVGFsaXNtYW47XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6IGZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgSXRlbSA9IHJlcXVpcmUoJy4uL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIFxyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIFRyYW5zbXV0ZSBleHRlbmRzIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBPcmIgb2YgVHJhbnNtdXRhdGlvblxyXG4gICAgICovXHJcbiAgICB2YXIgVHJhbnNtdXRlID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge1RyYW5zbXV0ZX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiVHJhbnNtdXRlXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIDEtMiBtb2RzXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAvLyB1cGdyYWRlIHRvIHJhcmVcclxuICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcblxyXG4gICAgICAgICAgICAgICAgaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPD0gMC41KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWFwcyBtb2Q6OmFwcGxpY2FibGVUbyBhcyBpZiBpdCB3ZXJlIGFscmVhZHkgbWFnaWNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1hcDogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgdXBncmFkZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk1BR0lDO1xyXG4gICAgICAgICAgICB2YXIgbW9kcyA9IHRoaXMuX3N1cGVyKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdyZXBzIG1vZDo6YXBwbGljYWJsZVRvIGFzIGlmIGl0IHdlcmUgYWxyZWFkeSBtYWdpY1xyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gc3VjY2Vzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtb2RzOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSB1cGdyYWRlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gdGhpcy5fc3VwZXIoaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW0ucmFyaXR5ICE9PSBJdGVtLlJBUklUWS5OT1JNQUwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IFRyYW5zbXV0ZS5BUFBMSUNBQkxFX0JZVEUuTk9UX1dISVRFO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKlxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCeXRlU2V0Lmh1bWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUcmFuc211dGUuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVHJhbnNtdXRlLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJUcmFuc211dGUuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJPcmIgb2YgVHJhbnNtdXRhdGlvblwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBUcmFuc211dGUuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfV0hJVEU6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIFRyYW5zbXV0ZS5tb2RfZmlsdGVyID0gZnVuY3Rpb24gKG1vZF9wcm9wcykge1xyXG4gICAgICAgIC8vIHByZWZpeC9zdWZmaXggb25seVxyXG4gICAgICAgIHJldHVybiBbTW9kLk1PRF9UWVBFLlBSRUZJWCwgTW9kLk1PRF9UWVBFLlNVRkZJWF0uaW5kZXhPZigrbW9kX3Byb3BzLkdlbmVyYXRpb25UeXBlKSAhPT0gLTE7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFRyYW5zbXV0ZTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBWYWFsIGV4dGVuZHMgQ3VycmVuY3lcclxuICAgICAqIFxyXG4gICAgICogaW5nYW1lIHJlcHJlc2VudGF0aW9uIG9mIFZhYWwgT3JiIG9ubHkgcmVnYXJkaW5nIGltcGxpY2l0IGNvcnJ1cHRpb25zXHJcbiAgICAgKi9cclxuICAgIHZhciBWYWFsID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge1ZhYWx9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBWYWFsLm1vZF9maWx0ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLmtsYXNzID0gXCJWYWFsXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIlZhYWwgT3JiXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIFZhYWwubW9kX2ZpbHRlciA9IGZ1bmN0aW9uIChtb2RfcHJvcHMpIHtcclxuICAgICAgICAvLyB2YWFsIGltcGxpY2l0c1xyXG4gICAgICAgIHJldHVybiBbTW9kLk1PRF9UWVBFLlZBQUxdLmluZGV4T2YoK21vZF9wcm9wcy5HZW5lcmF0aW9uVHlwZSkgIT09IC0xO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBWYWFsO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGdsb2JhbCBDbGFzcyAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgXHJcbiAgICB2YXIgUGF0aCA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHBhdGhfc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IHBhdGhfc3RyaW5nLnNwbGl0KFwiL1wiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuaXNfYWJzb2x1dGUgPSB0aGlzLnBhdGhbMF0gPT09ICcnO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pc0Fic29sdXRlKCkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucGF0aC5zaGlmdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRCYXNlbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoW3RoaXMucGF0aC5sZW5ndGggLSAxXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldERpcmVjdG9yaWVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGguc2xpY2UoMCwgdGhpcy5wYXRoLmxlbmd0aCAtIDEpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNBYnNvbHV0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc19hYnNvbHV0ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5leHRGaWxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnBhdGhbMF0gIT09ICcnKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoLnNoaWZ0KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QmFzZW5hbWUoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBQYXRoO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGdsb2JhbCBDbGFzcyAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIEludGVyZmFjZSBTZXJpYWxpemVhYmxlXHJcbiAgICAgKi9cclxuICAgIHZhciBTZXJpYWxpemVhYmxlID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICBzZXJpYWxpemU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGtsYXNzOiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW10sXHJcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogQ2xhc3MgLy8gYSBDbGFzcyBpbnN0YW5jZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB2YXIgc2VyaWFsaXplZF9zdHJ1Y3QgPSBuZXcgU2VyaWFsaXplYWJsZSgpLnNlcmlhbGl6ZSgpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIEBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zMzYyNDcxL2hvdy1jYW4taS1jYWxsLWEtamF2YXNjcmlwdC1jb25zdHJ1Y3Rvci11c2luZy1jYWxsLW9yLWFwcGx5XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc2VyaWFsaXplZFxyXG4gICAgICogQHJldHVybnMge01vZEZhY3RvcnlfTDEuTW9kRmFjdG9yeS5kZXNlcmlhbGl6ZS5GYWN0b3J5RnVuY3Rpb259XHJcbiAgICAgKi9cclxuICAgIFNlcmlhbGl6ZWFibGUuZGVzZXJpYWxpemUgPSBmdW5jdGlvbiAoc2VyaWFsaXplZCkge1xyXG4gICAgICAgIGlmICghU2VyaWFsaXplYWJsZS5jaGVja1N0cnVjdChzZXJpYWxpemVkKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwic3RydWN0IGRvZXNudCBtYXRjaCBpbnRlcmZhY2Ugc3RydWN0XCIsIHNlcmlhbGl6ZWQsIHNlcmlhbGl6ZWRfc3RydWN0KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29uc3RydWN0b3IgPSBzZXJpYWxpemVkLmNvbnN0cnVjdG9yO1xyXG4gICAgICAgIHZhciBhcmdzID0gW251bGxdLmNvbmNhdChzZXJpYWxpemVkLmFyZ3MpO1xyXG4gICAgICAgIHZhciBmYWN0b3J5RnVuY3Rpb24gPSBjb25zdHJ1Y3Rvci5iaW5kLmFwcGx5KGNvbnN0cnVjdG9yLCBhcmdzKTtcclxuICAgICAgICByZXR1cm4gbmV3IGZhY3RvcnlGdW5jdGlvbigpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgU2VyaWFsaXplYWJsZS5pbXBsZW1lbnRlZEJ5ID0gZnVuY3Rpb24gKGNsYXp6KSB7XHJcbiAgICAgICAgaWYgKCEoY2xhenogaW5zdGFuY2VvZiBDbGFzcykgfHwgdHlwZW9mIGNsYXp6LnNlcmlhbGl6ZSAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBTZXJpYWxpemVhYmxlLmNoZWNrU3RydWN0KGNsYXp6LnNlcmlhbGl6ZWQoKSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBTZXJpYWxpemVhYmxlLmNoZWNrU3RydWN0ID0gZnVuY3Rpb24gKHNlcmlhbGl6ZWQpIHtcclxuICAgICAgICB2YXIgaW1wbGVtZW50ZWRfYnkgPSB0cnVlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGNoZWNrIGlmIGVhY2ggcHJvcGVydHkgaW4gdGhlIHN0cnVjdCBoYXMgdGhlIHNhbWUgdHlwZVxyXG4gICAgICAgICQuZWFjaChzZXJpYWxpemVkX3N0cnVjdCwgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzZXJpYWxpemVkW2tleV0gIT09IHR5cGVvZiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgaW1wbGVtZW50ZWRfYnkgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYnJlYWtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBpbXBsZW1lbnRlZF9ieTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gU2VyaWFsaXplYWJsZTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuL0luaGVyaXRhbmNlJyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogSW50ZXJmYWNlXHJcbiAgICAgKi9cclxuICAgIHZhciBTcGF3bmFibGUgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy5zcGF3bndlaWdodF9jYWNoZWQgPSAwO1xyXG4gICAgICAgICAgICB0aGlzLnNwYXduY2hhbmNlID0gbnVsbDtcclxuICAgICAgICAgICAgdGhpcy5zcGF3bmFibGVfYnl0ZSA9IFNwYXduYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3Bhd25hYmxlT246IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaHVtYW5TcGF3bmNoYW5jZTogZnVuY3Rpb24gKHByZWNpc2lvbikge1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVzZXRTcGF3bmFibGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgICAgICBzcGF3bmFibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgICAgICBzcGF3bmFibGVDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIFNwYXduYWJsZS5tYXAgPSBmdW5jdGlvbiAobW9kX2NvbGxlY3Rpb24sIG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICByZXR1cm4gJC5tYXAobW9kX2NvbGxlY3Rpb24uc2xpY2UoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBpZiAoU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKG1vZF9jb250YWluZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBtb2Q7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBTcGF3bmFibGUubW9kcyA9IGZ1bmN0aW9uIChtb2RfY29sbGVjdGlvbiwgbW9kX2NvbnRhaW5lciwgc3VjY2Vzcykge1xyXG4gICAgICAgIHJldHVybiAkLmdyZXAobW9kX2NvbGxlY3Rpb24uc2xpY2UoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gIVNwYXduYWJsZS5pbXBsZW1lbnRlZEJ5KG1vZCkgfHwgbW9kLnNwYXduYWJsZU9uKG1vZF9jb250YWluZXIsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gaW50ZXJmYWNlIHBhdHRlcm5cclxuICAgIFNwYXduYWJsZS5pbXBsZW1lbnRlZEJ5ID0gZnVuY3Rpb24gKGNsYXp6KSB7XHJcbiAgICAgICAgcmV0dXJuICBjbGF6ei5zcGF3bmFibGVPbiAhPT0gX191bmRlZmluZWQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtBcnJheTxTcGF3bmFibGU+fSBzcGF3bmFibGVzXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBpZl9jYiBvcHRpb25hbCBjYWxsYmFjayB0byBmaWx0ZXIgbW9kc1xyXG4gICAgICogQHJldHVybnMge2Zsb2F0fVxyXG4gICAgICovXHJcbiAgICBTcGF3bmFibGUuY2FsY3VsYXRlU3Bhd25jaGFuY2UgPSBmdW5jdGlvbiAoc3Bhd25hYmxlcywgaWZfY2IpIHtcclxuICAgICAgICB2YXIgc3VtX3NwYXdud2VpZ2h0ID0gMDtcclxuICAgICAgICBpZiAodHlwZW9mIGlmX2NiICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGlmX2NiICA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRydWU7IH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgICQuZWFjaChzcGF3bmFibGVzLCBmdW5jdGlvbiAoXywgbW9kKSB7XHJcbiAgICAgICAgICAgIGlmIChTcGF3bmFibGUuaW1wbGVtZW50ZWRCeShtb2QpICYmIGlmX2NiKG1vZCkpIHtcclxuICAgICAgICAgICAgICAgIHN1bV9zcGF3bndlaWdodCArPSBtb2Quc3Bhd253ZWlnaHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gJC5tYXAoc3Bhd25hYmxlcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBpZiAoU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSAmJiBtb2Quc3Bhd253ZWlnaHQgIT09IG51bGwgJiYgaWZfY2IobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgbW9kLnNwYXduY2hhbmNlID0gbW9kLnNwYXdud2VpZ2h0IC8gc3VtX3NwYXdud2VpZ2h0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQ29udmVudGlvblxyXG4gICAgU3Bhd25hYmxlLlVOU0NBTk5FRCA9IDA7XHJcbiAgICBTcGF3bmFibGUuU1VDQ0VTUyA9IDE7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gU3Bhd25hYmxlO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBHZ3BrRW50cnkgPSByZXF1aXJlKCcuL0dncGtFbnRyeScpO1xyXG4gICAgdmFyIFZhbHVlUmFuZ2UgPSByZXF1aXJlKCcuL1ZhbHVlUmFuZ2UnKTtcclxuICAgIHJlcXVpcmUoJy4vY29uY2VybnMvQXJyYXknKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBTdGF0IGV4dGVuZHMgR2dwa0VudHJ5XHJcbiAgICAgKi9cclxuICAgIHZhciBTdGF0ID0gR2dwa0VudHJ5LmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKHByb3BzKTtcclxuICAgICAgICAgICAgdGhpcy52YWx1ZXMgPSBuZXcgVmFsdWVSYW5nZSgwLCAwKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHQ6IGZ1bmN0aW9uIChvdGhlcl9zdGF0cywgbG9jYWxpemF0aW9uKSB7XHJcbiAgICAgICAgICAgIGlmIChsb2NhbGl6YXRpb24gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBsb2NhbGl6YXRpb24gPSBTdGF0LmxvY2FsaXphdGlvbjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIGlkID0gdGhpcy5nZXRQcm9wKFwiSWRcIik7XHJcbiAgICAgICAgICAgIGlmIChsb2NhbGl6YXRpb24uZGF0YVtpZF0gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIm5vIGRlc2MgZm9yIFwiLCBpZCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaWQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBwYXJhbXMgPSB0aGlzLnRQYXJhbXMob3RoZXJfc3RhdHMsIGxvY2FsaXphdGlvbik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gbG9jYWxpemF0aW9uLnQuYXBwbHkobG9jYWxpemF0aW9uLCBbaWRdLmNvbmNhdChwYXJhbXMpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRQYXJhbXM6IGZ1bmN0aW9uIChvdGhlcl9zdGF0cywgbG9jYWxpemF0aW9uKSB7XHJcbiAgICAgICAgICAgIHZhciBpZCA9IHRoaXMuZ2V0UHJvcChcIklkXCIpO1xyXG4gICAgICAgICAgICB2YXIgcGFyYW1zID0gW3RoaXMudmFsdWVzLnRvQXJyYXkoKV07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWxvY2FsaXphdGlvbi5kYXRhW2lkXSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG90aGVyX3BhcmFtcyA9IGxvY2FsaXphdGlvbi5kYXRhW2lkXS5wYXJhbXM7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAob3RoZXJfcGFyYW1zICE9PSBfX3VuZGVmaW5lZCAmJiBvdGhlcl9wYXJhbXMubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICAgICAgcGFyYW1zID0gJC5tYXAob3RoZXJfcGFyYW1zLCBmdW5jdGlvbiAocGFyYW1faWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3RhdCA9ICQuZ3JlcChvdGhlcl9zdGF0cywgZnVuY3Rpb24gKHN0YXQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBhcmFtX2lkID09PSBzdGF0LmdldFByb3AoXCJJZFwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9KVswXTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdCA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETyBtYXliZSAwIHdpbGwgbWF0Y2ggc29tZXRoaW5nPyBiZXR0ZXIgb2Ygd2l0aCAraW5mP1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1swLCAwXV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW3N0YXQudmFsdWVzLnRvQXJyYXkoKV07XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIHZhbHVlU3RyaW5nOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIihcIiArIHRoaXMudmFsdWVzLnRvU3RyaW5nKCkgKyBcIilcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgU3RhdC5sb2NhbGl6YXRpb24gPSBudWxsO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFN0YXQ7XHJcbn0pKCk7IiwiLyogZ2xvYmFsIENsYXNzLCBWYWx1ZVJhbmdlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKFwiLi9Jbmhlcml0YW5jZVwiKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBWYWx1ZVJhbmdlXHJcbiAgICAgKiBcclxuICAgICAqIGEgMi1kaW1lbnNpb25hbCBhcnJheSB3aXRoIG9wZXJhdGlvbnMgZm9yIGNlcnRhaW4gbWF0aGVtYXRpY2FsIG9wZXJhdGlvbnNcclxuICAgICAqIGNhbiBjcmVhdGUgcmVjdXJzaXZlIHN0cnVjdHVyZXMgWygyLTQpLSg2LTgpXVxyXG4gICAgICovXHJcbiAgICB2YXIgVmFsdWVSYW5nZSA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKG1pbiwgbWF4KSB7XHJcbiAgICAgICAgICAgIHRoaXMubWluID0gbWluO1xyXG4gICAgICAgICAgICB0aGlzLm1heCA9IG1heDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRvQXJyYXk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFt0aGlzLm1pbiwgdGhpcy5tYXhdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdG9GaXhlZDogZnVuY3Rpb24gKHByZWNpc2lvbikge1xyXG4gICAgICAgICAgICAvLyB3aWxsIHR1cm4gMi4xIGludG8gMi4xMCBcclxuICAgICAgICAgICAgdmFyIG1pbiA9IHRoaXMubWluLnRvRml4ZWQocHJlY2lzaW9uKTtcclxuICAgICAgICAgICAgaWYgKCEobWluIGluc3RhbmNlb2YgVmFsdWVSYW5nZSkpIHtcclxuICAgICAgICAgICAgICAgIC8vIGJ1dCB3aXRoIGxlYWRpbmcgKyB3ZSB3aWxsIGdldCBhIG51bWJlciBhZ2FpblxyXG4gICAgICAgICAgICAgICAgbWluID0gK21pbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1heCA9IHRoaXMubWF4LnRvRml4ZWQocHJlY2lzaW9uKTtcclxuICAgICAgICAgICAgaWYgKCEobWF4IGluc3RhbmNlb2YgVmFsdWVSYW5nZSkpIHtcclxuICAgICAgICAgICAgICAgIC8vIGJ1dCB3aXRoIGxlYWRpbmcgKyB3ZSB3aWxsIGdldCBhIG51bWJlciBhZ2FpblxyXG4gICAgICAgICAgICAgICAgbWF4ID0gK21heDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZVJhbmdlKG1pbiwgbWF4KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRvU3RyaW5nOiBmdW5jdGlvbiAoZGVwdGgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubWluLmVxdWFscyh0aGlzLm1heCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1pbi50b1N0cmluZygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoZGVwdGggPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBkZXB0aCA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHNpZ25hdHVyZSBvZiBudW1iZXIudG9TdHJpbmcocmFkaXgpIHZhcmllcyBmcm9tIHRoaXMgbWV0aG9kIHNpZyBcclxuICAgICAgICAgICAgdmFyIG1pbiA9IHRoaXMubWluO1xyXG4gICAgICAgICAgICBpZiAobWluIGluc3RhbmNlb2YgVmFsdWVSYW5nZSkge1xyXG4gICAgICAgICAgICAgICAgbWluID0gbWluLnRvU3RyaW5nKGRlcHRoICsgMSk7XHJcbiAgICAgICAgICAgIH0gXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbWF4ID0gdGhpcy5tYXg7XHJcbiAgICAgICAgICAgIGlmIChtYXggaW5zdGFuY2VvZiBWYWx1ZVJhbmdlKSB7XHJcbiAgICAgICAgICAgICAgICBtYXggPSBtYXgudG9TdHJpbmcoZGVwdGggKyAxKTtcclxuICAgICAgICAgICAgfSBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAoZGVwdGggPiAwID8gXCIoXCIgOiBcIlwiKSArIFxyXG4gICAgICAgICAgICAgICAgICAgIFttaW4sIG1heF0uam9pbihkZXB0aCAlIDIgPyBWYWx1ZVJhbmdlLnNlcEV2ZW4gOiBWYWx1ZVJhbmdlLnNlcE9kZCkgKyBcclxuICAgICAgICAgICAgICAgICAgICAoZGVwdGggPiAwID8gXCIpXCIgOiBcIlwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNsb25lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgVmFsdWVSYW5nZSh0aGlzLm1pbiwgdGhpcy5tYXgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYWRkOiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVmFsdWVSYW5nZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkVmFsdWVSYW5nZSh2YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkU2NhbGFyKHZhbHVlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFkZFNjYWxhcjogZnVuY3Rpb24gKGxhbWJkYSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlUmFuZ2UodGhpcy5taW4gKyBsYW1iZGEsIHRoaXMubWF4ICsgbGFtYmRhKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFkZFZhbHVlUmFuZ2U6IGZ1bmN0aW9uICh2YWx1ZV9yYW5nZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlUmFuZ2UodmFsdWVfcmFuZ2UuYWRkKHRoaXMubWluKSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZV9yYW5nZS5hZGQodGhpcy5tYXgpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVxdWFsczogZnVuY3Rpb24gKG90aGVyX3ZhbHVlX3JhbmdlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvdGhlcl92YWx1ZV9yYW5nZSBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UgJiYgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5taW4uZXF1YWxzKG90aGVyX3ZhbHVlX3JhbmdlLm1pbikgJiYgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXguZXF1YWxzKG90aGVyX3ZhbHVlX3JhbmdlLm1heCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtdWx0aXBseTogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm11bHRpcGx5VmFsdWVSYW5nZSh2YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubXVsdGlwbHlTY2FsYXIodmFsdWUpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXVsdGlwbHlTY2FsYXI6IGZ1bmN0aW9uIChsYW1iZGEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZVJhbmdlKHRoaXMubWluICogbGFtYmRhLCB0aGlzLm1heCAqIGxhbWJkYSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtdWx0aXBseVZhbHVlUmFuZ2U6IGZ1bmN0aW9uICh2YWx1ZV9yYW5nZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlUmFuZ2UodmFsdWVfcmFuZ2UubXVsdGlwbHkodGhpcy5taW4pLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlX3JhbmdlLm11bHRpcGx5KHRoaXMubWF4KSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc1plcm86IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9BcnJheSgpLmlzWmVybygpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBWYWx1ZVJhbmdlLnNlcE9kZCA9IFwiIHRvIFwiO1xyXG4gICAgVmFsdWVSYW5nZS5zZXBFdmVuID0gXCItXCI7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gVmFsdWVSYW5nZTtcclxufSkoKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgZXZlcnkgdmFsdWUgaW4gdGhpcyBhcnJheSBlcXVhbCB6ZXJvXHJcbiAgICAgKi9cclxuICAgIEFycmF5LnByb3RvdHlwZS5pc1plcm8gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGEgPSB0aGlzLnZhbHVlT2YoKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYS5sZW5ndGg7IGkgPCBsZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFbaV0uaXNaZXJvID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWFbaV0uaXNaZXJvKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoK2FbaV0gIT09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qXHJcbiAgICAvKipcclxuICAgICAqIEBsaW5rIHtodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzEzNDg2NDc5L2hvdy10by1nZXQtYW4tYXJyYXktb2YtdW5pcXVlLXZhbHVlcy1mcm9tLWFuLWFycmF5LWNvbnRhaW5pbmctZHVwbGljYXRlcy1pbi1qYXZhfVxyXG4gICAgICogXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXkucHJvdG90eXBlQGNhbGw7cmV2ZXJzZUBjYWxsO2ZpbHRlckBjYWxsO3JldmVyc2V9XHJcbiAgICAgKlxyXG4gICAgQXJyYXkucHJvdG90eXBlLnVuaXF1ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5yZXZlcnNlKCkuZmlsdGVyKGZ1bmN0aW9uIChlLCBpLCBhcnIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGFyci5pbmRleE9mKGUsIGkrMSkgPT09IC0xO1xyXG4gICAgICAgIH0pLnJldmVyc2UoKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogalF1ZXJ5IG1hcCBlcXVpdlxyXG4gICAgICogQHBhcmFtIHt0eXBlfSBjYWxsYmFja2ZuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXkucHJvdG90eXBlQGNhbGw7bWFwQGNhbGw7ZmlsdGVyfVxyXG4gICAgICpcclxuICAgIEFycmF5LnByb3RvdHlwZS4kbWFwID0gZnVuY3Rpb24gKGNhbGxiYWNrZm4pIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5tYXAoY2FsbGJhY2tmbikuZmlsdGVyKGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgIT09IG51bGw7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGludGVyc2VjdGlvbiBvZiB0d28gYXJyYXlcclxuICAgICAqIGh0dHA6Ly9qc2ZpZGRsZS5uZXQvbmVvc3dmL2FYeld3L1xyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge3R5cGV9IGFcclxuICAgICAqIEBwYXJhbSB7dHlwZX0gYlxyXG4gICAgICogQHJldHVybnMge0FycmF5fEFycmF5LmludGVyc2VjdF9zYWZlLnJlc3VsdH1cclxuICAgICAqXHJcbiAgICBBcnJheS5pbnRlcnNlY3QgPSBmdW5jdGlvbiAoYSwgYilcclxuICAgIHtcclxuICAgICAgdmFyIGFpID0gYmk9IDA7XHJcbiAgICAgIHZhciByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgIHdoaWxlKCBhaSA8IGEubGVuZ3RoICYmIGJpIDwgYi5sZW5ndGggKXtcclxuICAgICAgICAgaWYgICAgICAoYVthaV0gPCBiW2JpXSApeyBhaSsrOyB9XHJcbiAgICAgICAgIGVsc2UgaWYgKGFbYWldID4gYltiaV0gKXsgYmkrKzsgfVxyXG4gICAgICAgICBlbHNlICB0aGV5J3JlIGVxdWFsICpcclxuICAgICAgICAge1xyXG4gICAgICAgICAgIHJlc3VsdC5wdXNoKGFpKTtcclxuICAgICAgICAgICBhaSsrO1xyXG4gICAgICAgICAgIGJpKys7XHJcbiAgICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEFycmF5LnByb3RvdHlwZS5pbnRlcnNlY3QgPSBmdW5jdGlvbiAob3RoZXJfYXJyKSB7XHJcbiAgICAgICAgcmV0dXJuIEFycmF5LmludGVyc2VjdCh0aGlzLnZhbHVlT2YoKSwgb3RoZXJfYXJyKTtcclxuICAgIH07Ly8qL1xyXG59KSgpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIFxyXG4gICAgLy8gdG9kbyBpZi1leGlzdHNcclxuICAgIHZhciBCeXRlU2V0ID0gQ2xhc3MuZXh0ZW5kKHt9KTtcclxuXHJcbiAgICAvLyBUT0RPIGJsYWNrbGlzdCBpbnN0ZWFkIG9mIGlnbm9yZVxyXG4gICAgQnl0ZVNldC5odW1hbiA9IGZ1bmN0aW9uKGJ5dGUsIGJ5dGVfc2V0LCBpZ25vcmUsIGxvY2FsaXphdGlvbl9wYXRoKSB7XHJcbiAgICAgICAgdmFyIHN0cmluZ3MgPSBbXTtcclxuICAgICAgICB2YXIgYml0cyA9IFtdO1xyXG5cclxuICAgICAgICAkLmVhY2goYnl0ZV9zZXQsIGZ1bmN0aW9uIChrZXksIGJpdCkge1xyXG4gICAgICAgICAgICBpZiAoYnl0ZSAmIGJpdCAmJiAhKGJ5dGUgJiBpZ25vcmUpKSB7XHJcbiAgICAgICAgICAgICAgICBiaXRzLnB1c2goYml0KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGxvY2FsaXplZCA9IE9iamVjdC5ieVN0cmluZyhCeXRlU2V0LmxvY2FsaXphdGlvbiwgbG9jYWxpemF0aW9uX3BhdGggKyBcIi5cIiArIGJpdCk7XHJcbiAgICAgICAgICAgICAgICBzdHJpbmdzLnB1c2gobG9jYWxpemVkID8gbG9jYWxpemVkIDoga2V5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzdHJpbmdzOiBzdHJpbmdzLFxyXG4gICAgICAgICAgICBiaXRzOiBiaXRzXHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEJ5dGVTZXQubG9jYWxpemF0aW9uID0gbnVsbDtcclxuICAgIFxyXG4gICAgQnl0ZVNldC5pbml0TG9jYWxpemF0aW9uID0gZnVuY3Rpb24gKCRsZWdlbmRzKSB7XHJcbiAgICAgICAgQnl0ZVNldC5sb2NhbGl6YXRpb24gPSB7fTtcclxuICAgICAgICBcclxuICAgICAgICAkKFwidWwubGVnZW5kXCIsICRsZWdlbmRzKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyICRsZWdlbmQgPSAkKHRoaXMpO1xyXG4gICAgICAgICAgICB2YXIga2xhc3MgPSAkbGVnZW5kLmRhdGEoXCJrbGFzc1wiKTtcclxuICAgICAgICAgICAgdmFyIGJ5dGVfaWRlbnQgPSAkbGVnZW5kLmRhdGEoXCJieXRlLWlkZW50XCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKEJ5dGVTZXQubG9jYWxpemF0aW9uW2tsYXNzXSA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIEJ5dGVTZXQubG9jYWxpemF0aW9uW2tsYXNzXSA9IHt9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBCeXRlU2V0LmxvY2FsaXphdGlvbltrbGFzc11bYnl0ZV9pZGVudF0gPSB7fTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICQoXCJsaVwiLCB0aGlzKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHZhciAkbGkgPSAkKHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgQnl0ZVNldC5sb2NhbGl6YXRpb25ba2xhc3NdW2J5dGVfaWRlbnRdWyRsaS5kYXRhKGJ5dGVfaWRlbnQpXSA9ICRsaS50ZXh0KCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnNvbGUubG9nKEJ5dGVTZXQubG9jYWxpemF0aW9uKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIHR1cm4gb2YgZXZlcnl0aGluZyBibGFja2xpc3RlZCAoYnl0ZSB4b3IgKGJ5dGUgJiBibGFja2xpc3QpID0gYnl0ZSAmICFibGFja2xpc3QpXHJcbiAgICBCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCA9IGZ1bmN0aW9uIChieXRlLCBibGFja2xpc3QpIHtcclxuICAgICAgICByZXR1cm4gYnl0ZSAmIH5ibGFja2xpc3Q7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEJ5dGVTZXQ7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgTWF0aC5yYW5kID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XHJcbiAgICAgICAgLy8gbWF0aC5yYW5kb20oKSA9IFswLDEpID0+IG1heCAtIG1pbiAgKyAxID0gWzAsMV1cclxuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSkgKyBtaW4pO1xyXG4gICAgfTtcclxufSkoKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICBOdW1iZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChvdGhlcl9udW1iZXIpIHtcclxuICAgICAgICByZXR1cm4gdHlwZW9mIG90aGVyX251bWJlciA9PT0gJ251bWJlcicgJiYgXHJcbiAgICAgICAgICAgICAgICB0aGlzLnZhbHVlT2YoKSA9PT0gb3RoZXJfbnVtYmVyO1xyXG4gICAgfTtcclxufSkoKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzY0OTE0NjMvYWNjZXNzaW5nLW5lc3RlZC1qYXZhc2NyaXB0LW9iamVjdHMtd2l0aC1zdHJpbmcta2V5XHJcbiAgICBPYmplY3QuYnlTdHJpbmcgPSBmdW5jdGlvbihvLCBzKSB7XHJcbiAgICAgICAgaWYgKHMgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcyA9IHMucmVwbGFjZSgvXFxbKFxcdyspXFxdL2csICcuJDEnKTsgLy8gY29udmVydCBpbmRleGVzIHRvIHByb3BlcnRpZXNcclxuICAgICAgICBzID0gcy5yZXBsYWNlKC9eXFwuLywgJycpOyAgICAgICAgICAgLy8gc3RyaXAgYSBsZWFkaW5nIGRvdFxyXG4gICAgICAgIHZhciBhID0gcy5zcGxpdCgnLicpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYS5sZW5ndGg7IGkgPCBuOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGsgPSBhW2ldO1xyXG4gICAgICAgICAgICBpZiAoayBpbiBvKSB7XHJcbiAgICAgICAgICAgICAgICBvID0gb1trXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbztcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogalF1ZXJ5IG1hcCBlcXVpdlxyXG4gICAgICogQHBhcmFtIHt0eXBlfSBjYWxsYmFja2ZuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXkucHJvdG90eXBlQGNhbGw7bWFwQGNhbGw7ZmlsdGVyfVxyXG4gICAgICpcclxuICAgIE9iamVjdC5wcm90b3R5cGUuJG1hcCA9IGZ1bmN0aW9uIChjYWxsYmFja2ZuKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubWFwKGNhbGxiYWNrZm4pLmZpbHRlcihmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlICE9PSBudWxsO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgT2JqZWN0LnByb3RvdHlwZS5tYXAgPSBmdW5jdGlvbiAoY2FsbGJhY2tmbikge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcy52YWx1ZU9mKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2VsZi5mb3JFYWNoKGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XHJcbiAgICAgICAgICAgIHNlbGZba2V5XSA9IGNhbGxiYWNrZm4odmFsdWUsIGtleSwgc2VsZik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHNlbGY7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBpZiAoISQpIHtcclxuICAgICAgICBPYmplY3QucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiAoY2FsbGJhY2tmbikge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2B2YWx1ZWA6JywgdGhpc1trZXldKTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdga2V5YDonLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2B0aGlzYDonLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrZm4odGhpc1trZXldLCBrZXksIHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH0vLyovXHJcbn0pKCk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgU3RyaW5nLnByb3RvdHlwZS51Y2ZpcnN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnZhbHVlT2YoKS5yZXBsYWNlKC9eKFthLXpdKS8sIGZ1bmN0aW9uIChnKSB7IHJldHVybiBnLnRvVXBwZXJDYXNlKCk7IH0pOyAgICBcclxuICAgIH07XHJcbiAgICBcclxuICAgIFN0cmluZy5wcm90b3R5cGUudW5kZXJzY29yZVRvSHVtYW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudmFsdWVPZigpXHJcbiAgICAgICAgICAgICAgICAvLyByZXBsYWNlIHVuZGVyc2NvcmVcclxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9fKFxcdykvZywgZnVuY3Rpb24gKGcpIHsgcmV0dXJuIFwiIFwiICsgZ1sxXS50b1VwcGVyQ2FzZSgpOyB9KS51Y2ZpcnN0KCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgIH07XHJcbn0pKCk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEB0eXBlIFN0cmluZ2pRdWVyeSB1dGlsaXRpZXMgc28gd2UgY2FuIHJ1biBpbiBicm93c2VyIGFuZCBvbiBzZXJ2ZXIgd2l0aG91dCBicm93c2VyaWZ5XG4gICAgICovXG4gICAgXG4gICAgdmFyIHZlcnNpb24gPSBcIjIuMi4wXCI7XG4gICAgXG4gICAgdmFyIGFyciA9IFtdO1xuICAgIFxuICAgIHZhciBzbGljZSA9IGFyci5zbGljZTtcblxuICAgIHZhciBjb25jYXQgPSBhcnIuY29uY2F0O1xuXG4gICAgdmFyIHB1c2ggPSBhcnIucHVzaDtcblxuICAgIHZhciBpbmRleE9mID0gYXJyLmluZGV4T2Y7XG5cbiAgICB2YXIgY2xhc3MydHlwZSA9IHt9O1xuXG4gICAgdmFyIHRvU3RyaW5nID0gY2xhc3MydHlwZS50b1N0cmluZztcblxuICAgIHZhciBoYXNPd24gPSBjbGFzczJ0eXBlLmhhc093blByb3BlcnR5O1xuXG4gICAgdmFyIHN1cHBvcnQgPSB7fTtcbiAgICBcbiAgICB2YXIgc29ydE9yZGVyID0gZnVuY3Rpb24oIGEsIGIgKSB7XG5cdFx0aWYgKCBhID09PSBiICkge1xuXHRcdFx0aGFzRHVwbGljYXRlID0gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIDA7XG5cdH1cbiAgICBcbiAgICBmdW5jdGlvbiBpc0FycmF5TGlrZSggb2JqICkge1xuICAgICAgICAgICAgLy8gU3VwcG9ydDogaU9TIDguMiAobm90IHJlcHJvZHVjaWJsZSBpbiBzaW11bGF0b3IpXG4gICAgICAgICAgICAvLyBgaW5gIGNoZWNrIHVzZWQgdG8gcHJldmVudCBKSVQgZXJyb3IgKGdoLTIxNDUpXG4gICAgICAgICAgICAvLyBoYXNPd24gaXNuJ3QgdXNlZCBoZXJlIGR1ZSB0byBmYWxzZSBuZWdhdGl2ZXNcbiAgICAgICAgICAgIC8vIHJlZ2FyZGluZyBOb2RlbGlzdCBsZW5ndGggaW4gSUVcbiAgICAgICAgICAgIHZhciBsZW5ndGggPSAhIW9iaiAmJiBcImxlbmd0aFwiIGluIG9iaiAmJiBvYmoubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICB0eXBlID0galF1ZXJ5LnR5cGUoIG9iaiApO1xuXG4gICAgICAgICAgICBpZiAoIHR5cGUgPT09IFwiZnVuY3Rpb25cIiB8fCBqUXVlcnkuaXNXaW5kb3coIG9iaiApICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0eXBlID09PSBcImFycmF5XCIgfHwgbGVuZ3RoID09PSAwIHx8XG4gICAgICAgICAgICAgICAgICAgIHR5cGVvZiBsZW5ndGggPT09IFwibnVtYmVyXCIgJiYgbGVuZ3RoID4gMCAmJiAoIGxlbmd0aCAtIDEgKSBpbiBvYmo7XG4gICAgfSAgIFxuICAgIFxuICAgIHZhciBqUXVlcnkgPSB7XG4gICAgICAgIC8vIFVuaXF1ZSBmb3IgZWFjaCBjb3B5IG9mIGpRdWVyeSBvbiB0aGUgcGFnZVxuXHRleHBhbmRvOiBcImpRdWVyeVwiICsgKCB2ZXJzaW9uICsgTWF0aC5yYW5kb20oKSApLnJlcGxhY2UoIC9cXEQvZywgXCJcIiApLFxuXG5cdC8vIEFzc3VtZSBqUXVlcnkgaXMgcmVhZHkgd2l0aG91dCB0aGUgcmVhZHkgbW9kdWxlXG5cdGlzUmVhZHk6IHRydWUsXG5cblx0ZXJyb3I6IGZ1bmN0aW9uKCBtc2cgKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCBtc2cgKTtcblx0fSxcblxuXHRub29wOiBmdW5jdGlvbigpIHt9LFxuXG5cdGlzRnVuY3Rpb246IGZ1bmN0aW9uKCBvYmogKSB7XG5cdFx0cmV0dXJuIGpRdWVyeS50eXBlKCBvYmogKSA9PT0gXCJmdW5jdGlvblwiO1xuXHR9LFxuXG5cdGlzQXJyYXk6IEFycmF5LmlzQXJyYXksXG5cblx0aXNXaW5kb3c6IGZ1bmN0aW9uKCBvYmogKSB7XG5cdFx0cmV0dXJuIG9iaiAhPSBudWxsICYmIG9iaiA9PT0gb2JqLndpbmRvdztcblx0fSxcblxuXHRpc051bWVyaWM6IGZ1bmN0aW9uKCBvYmogKSB7XG5cblx0XHQvLyBwYXJzZUZsb2F0IE5hTnMgbnVtZXJpYy1jYXN0IGZhbHNlIHBvc2l0aXZlcyAobnVsbHx0cnVlfGZhbHNlfFwiXCIpXG5cdFx0Ly8gLi4uYnV0IG1pc2ludGVycHJldHMgbGVhZGluZy1udW1iZXIgc3RyaW5ncywgcGFydGljdWxhcmx5IGhleCBsaXRlcmFscyAoXCIweC4uLlwiKVxuXHRcdC8vIHN1YnRyYWN0aW9uIGZvcmNlcyBpbmZpbml0aWVzIHRvIE5hTlxuXHRcdC8vIGFkZGluZyAxIGNvcnJlY3RzIGxvc3Mgb2YgcHJlY2lzaW9uIGZyb20gcGFyc2VGbG9hdCAoIzE1MTAwKVxuXHRcdHZhciByZWFsU3RyaW5nT2JqID0gb2JqICYmIG9iai50b1N0cmluZygpO1xuXHRcdHJldHVybiAhalF1ZXJ5LmlzQXJyYXkoIG9iaiApICYmICggcmVhbFN0cmluZ09iaiAtIHBhcnNlRmxvYXQoIHJlYWxTdHJpbmdPYmogKSArIDEgKSA+PSAwO1xuXHR9LFxuXG5cdGlzUGxhaW5PYmplY3Q6IGZ1bmN0aW9uKCBvYmogKSB7XG5cblx0XHQvLyBOb3QgcGxhaW4gb2JqZWN0czpcblx0XHQvLyAtIEFueSBvYmplY3Qgb3IgdmFsdWUgd2hvc2UgaW50ZXJuYWwgW1tDbGFzc11dIHByb3BlcnR5IGlzIG5vdCBcIltvYmplY3QgT2JqZWN0XVwiXG5cdFx0Ly8gLSBET00gbm9kZXNcblx0XHQvLyAtIHdpbmRvd1xuXHRcdGlmICggalF1ZXJ5LnR5cGUoIG9iaiApICE9PSBcIm9iamVjdFwiIHx8IG9iai5ub2RlVHlwZSB8fCBqUXVlcnkuaXNXaW5kb3coIG9iaiApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICggb2JqLmNvbnN0cnVjdG9yICYmXG5cdFx0XHRcdCFoYXNPd24uY2FsbCggb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgXCJpc1Byb3RvdHlwZU9mXCIgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBJZiB0aGUgZnVuY3Rpb24gaGFzbid0IHJldHVybmVkIGFscmVhZHksIHdlJ3JlIGNvbmZpZGVudCB0aGF0XG5cdFx0Ly8gfG9ianwgaXMgYSBwbGFpbiBvYmplY3QsIGNyZWF0ZWQgYnkge30gb3IgY29uc3RydWN0ZWQgd2l0aCBuZXcgT2JqZWN0XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cblx0aXNFbXB0eU9iamVjdDogZnVuY3Rpb24oIG9iaiApIHtcblx0XHR2YXIgbmFtZTtcblx0XHRmb3IgKCBuYW1lIGluIG9iaiApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cblx0dHlwZTogZnVuY3Rpb24oIG9iaiApIHtcblx0XHRpZiAoIG9iaiA9PSBudWxsICkge1xuXHRcdFx0cmV0dXJuIG9iaiArIFwiXCI7XG5cdFx0fVxuXG5cdFx0Ly8gU3VwcG9ydDogQW5kcm9pZDw0LjAsIGlPUzw2IChmdW5jdGlvbmlzaCBSZWdFeHApXG5cdFx0cmV0dXJuIHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIG9iaiA9PT0gXCJmdW5jdGlvblwiID9cblx0XHRcdGNsYXNzMnR5cGVbIHRvU3RyaW5nLmNhbGwoIG9iaiApIF0gfHwgXCJvYmplY3RcIiA6XG5cdFx0XHR0eXBlb2Ygb2JqO1xuXHR9LFxuXG5cdC8vIEV2YWx1YXRlcyBhIHNjcmlwdCBpbiBhIGdsb2JhbCBjb250ZXh0XG5cdGdsb2JhbEV2YWw6IGZ1bmN0aW9uKCBjb2RlICkge1xuXHRcdHZhciBzY3JpcHQsXG5cdFx0XHRpbmRpcmVjdCA9IGV2YWw7XG5cblx0XHRjb2RlID0galF1ZXJ5LnRyaW0oIGNvZGUgKTtcblxuXHRcdGlmICggY29kZSApIHtcblxuXHRcdFx0Ly8gSWYgdGhlIGNvZGUgaW5jbHVkZXMgYSB2YWxpZCwgcHJvbG9ndWUgcG9zaXRpb25cblx0XHRcdC8vIHN0cmljdCBtb2RlIHByYWdtYSwgZXhlY3V0ZSBjb2RlIGJ5IGluamVjdGluZyBhXG5cdFx0XHQvLyBzY3JpcHQgdGFnIGludG8gdGhlIGRvY3VtZW50LlxuXHRcdFx0aWYgKCBjb2RlLmluZGV4T2YoIFwidXNlIHN0cmljdFwiICkgPT09IDEgKSB7XG5cdFx0XHRcdHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoIFwic2NyaXB0XCIgKTtcblx0XHRcdFx0c2NyaXB0LnRleHQgPSBjb2RlO1xuXHRcdFx0XHRkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKCBzY3JpcHQgKS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBzY3JpcHQgKTtcblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0Ly8gT3RoZXJ3aXNlLCBhdm9pZCB0aGUgRE9NIG5vZGUgY3JlYXRpb24sIGluc2VydGlvblxuXHRcdFx0XHQvLyBhbmQgcmVtb3ZhbCBieSB1c2luZyBhbiBpbmRpcmVjdCBnbG9iYWwgZXZhbFxuXG5cdFx0XHRcdGluZGlyZWN0KCBjb2RlICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdC8vIENvbnZlcnQgZGFzaGVkIHRvIGNhbWVsQ2FzZTsgdXNlZCBieSB0aGUgY3NzIGFuZCBkYXRhIG1vZHVsZXNcblx0Ly8gU3VwcG9ydDogSUU5LTExK1xuXHQvLyBNaWNyb3NvZnQgZm9yZ290IHRvIGh1bXAgdGhlaXIgdmVuZG9yIHByZWZpeCAoIzk1NzIpXG5cdGNhbWVsQ2FzZTogZnVuY3Rpb24oIHN0cmluZyApIHtcblx0XHRyZXR1cm4gc3RyaW5nLnJlcGxhY2UoIHJtc1ByZWZpeCwgXCJtcy1cIiApLnJlcGxhY2UoIHJkYXNoQWxwaGEsIGZjYW1lbENhc2UgKTtcblx0fSxcblxuXHRub2RlTmFtZTogZnVuY3Rpb24oIGVsZW0sIG5hbWUgKSB7XG5cdFx0cmV0dXJuIGVsZW0ubm9kZU5hbWUgJiYgZWxlbS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSBuYW1lLnRvTG93ZXJDYXNlKCk7XG5cdH0sXG5cblx0ZWFjaDogZnVuY3Rpb24oIG9iaiwgY2FsbGJhY2sgKSB7XG5cdFx0dmFyIGxlbmd0aCwgaSA9IDA7XG5cblx0XHRpZiAoIGlzQXJyYXlMaWtlKCBvYmogKSApIHtcblx0XHRcdGxlbmd0aCA9IG9iai5sZW5ndGg7XG5cdFx0XHRmb3IgKCA7IGkgPCBsZW5ndGg7IGkrKyApIHtcblx0XHRcdFx0aWYgKCBjYWxsYmFjay5jYWxsKCBvYmpbIGkgXSwgaSwgb2JqWyBpIF0gKSA9PT0gZmFsc2UgKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yICggaSBpbiBvYmogKSB7XG5cdFx0XHRcdGlmICggY2FsbGJhY2suY2FsbCggb2JqWyBpIF0sIGksIG9ialsgaSBdICkgPT09IGZhbHNlICkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9iajtcblx0fSxcblxuXHQvLyBTdXBwb3J0OiBBbmRyb2lkPDQuMVxuXHR0cmltOiBmdW5jdGlvbiggdGV4dCApIHtcblx0XHRyZXR1cm4gdGV4dCA9PSBudWxsID9cblx0XHRcdFwiXCIgOlxuXHRcdFx0KCB0ZXh0ICsgXCJcIiApLnJlcGxhY2UoIHJ0cmltLCBcIlwiICk7XG5cdH0sXG5cblx0Ly8gcmVzdWx0cyBpcyBmb3IgaW50ZXJuYWwgdXNhZ2Ugb25seVxuXHRtYWtlQXJyYXk6IGZ1bmN0aW9uKCBhcnIsIHJlc3VsdHMgKSB7XG5cdFx0dmFyIHJldCA9IHJlc3VsdHMgfHwgW107XG5cblx0XHRpZiAoIGFyciAhPSBudWxsICkge1xuXHRcdFx0aWYgKCBpc0FycmF5TGlrZSggT2JqZWN0KCBhcnIgKSApICkge1xuXHRcdFx0XHRqUXVlcnkubWVyZ2UoIHJldCxcblx0XHRcdFx0XHR0eXBlb2YgYXJyID09PSBcInN0cmluZ1wiID9cblx0XHRcdFx0XHRbIGFyciBdIDogYXJyXG5cdFx0XHRcdCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwdXNoLmNhbGwoIHJldCwgYXJyICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJldDtcblx0fSxcblxuXHRpbkFycmF5OiBmdW5jdGlvbiggZWxlbSwgYXJyLCBpICkge1xuXHRcdHJldHVybiBhcnIgPT0gbnVsbCA/IC0xIDogaW5kZXhPZi5jYWxsKCBhcnIsIGVsZW0sIGkgKTtcblx0fSxcblxuXHRtZXJnZTogZnVuY3Rpb24oIGZpcnN0LCBzZWNvbmQgKSB7XG5cdFx0dmFyIGxlbiA9ICtzZWNvbmQubGVuZ3RoLFxuXHRcdFx0aiA9IDAsXG5cdFx0XHRpID0gZmlyc3QubGVuZ3RoO1xuXG5cdFx0Zm9yICggOyBqIDwgbGVuOyBqKysgKSB7XG5cdFx0XHRmaXJzdFsgaSsrIF0gPSBzZWNvbmRbIGogXTtcblx0XHR9XG5cblx0XHRmaXJzdC5sZW5ndGggPSBpO1xuXG5cdFx0cmV0dXJuIGZpcnN0O1xuXHR9LFxuXG5cdGdyZXA6IGZ1bmN0aW9uKCBlbGVtcywgY2FsbGJhY2ssIGludmVydCApIHtcblx0XHR2YXIgY2FsbGJhY2tJbnZlcnNlLFxuXHRcdFx0bWF0Y2hlcyA9IFtdLFxuXHRcdFx0aSA9IDAsXG5cdFx0XHRsZW5ndGggPSBlbGVtcy5sZW5ndGgsXG5cdFx0XHRjYWxsYmFja0V4cGVjdCA9ICFpbnZlcnQ7XG5cblx0XHQvLyBHbyB0aHJvdWdoIHRoZSBhcnJheSwgb25seSBzYXZpbmcgdGhlIGl0ZW1zXG5cdFx0Ly8gdGhhdCBwYXNzIHRoZSB2YWxpZGF0b3IgZnVuY3Rpb25cblx0XHRmb3IgKCA7IGkgPCBsZW5ndGg7IGkrKyApIHtcblx0XHRcdGNhbGxiYWNrSW52ZXJzZSA9ICFjYWxsYmFjayggZWxlbXNbIGkgXSwgaSApO1xuXHRcdFx0aWYgKCBjYWxsYmFja0ludmVyc2UgIT09IGNhbGxiYWNrRXhwZWN0ICkge1xuXHRcdFx0XHRtYXRjaGVzLnB1c2goIGVsZW1zWyBpIF0gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbWF0Y2hlcztcblx0fSxcblxuXHQvLyBhcmcgaXMgZm9yIGludGVybmFsIHVzYWdlIG9ubHlcblx0bWFwOiBmdW5jdGlvbiggZWxlbXMsIGNhbGxiYWNrLCBhcmcgKSB7XG5cdFx0dmFyIGxlbmd0aCwgdmFsdWUsXG5cdFx0XHRpID0gMCxcblx0XHRcdHJldCA9IFtdO1xuXG5cdFx0Ly8gR28gdGhyb3VnaCB0aGUgYXJyYXksIHRyYW5zbGF0aW5nIGVhY2ggb2YgdGhlIGl0ZW1zIHRvIHRoZWlyIG5ldyB2YWx1ZXNcblx0XHRpZiAoIGlzQXJyYXlMaWtlKCBlbGVtcyApICkge1xuXHRcdFx0bGVuZ3RoID0gZWxlbXMubGVuZ3RoO1xuXHRcdFx0Zm9yICggOyBpIDwgbGVuZ3RoOyBpKysgKSB7XG5cdFx0XHRcdHZhbHVlID0gY2FsbGJhY2soIGVsZW1zWyBpIF0sIGksIGFyZyApO1xuXG5cdFx0XHRcdGlmICggdmFsdWUgIT0gbnVsbCApIHtcblx0XHRcdFx0XHRyZXQucHVzaCggdmFsdWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0Ly8gR28gdGhyb3VnaCBldmVyeSBrZXkgb24gdGhlIG9iamVjdCxcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yICggaSBpbiBlbGVtcyApIHtcblx0XHRcdFx0dmFsdWUgPSBjYWxsYmFjayggZWxlbXNbIGkgXSwgaSwgYXJnICk7XG5cblx0XHRcdFx0aWYgKCB2YWx1ZSAhPSBudWxsICkge1xuXHRcdFx0XHRcdHJldC5wdXNoKCB2YWx1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRmxhdHRlbiBhbnkgbmVzdGVkIGFycmF5c1xuXHRcdHJldHVybiBjb25jYXQuYXBwbHkoIFtdLCByZXQgKTtcblx0fSxcblxuXHQvLyBBIGdsb2JhbCBHVUlEIGNvdW50ZXIgZm9yIG9iamVjdHNcblx0Z3VpZDogMSxcblxuXHQvLyBCaW5kIGEgZnVuY3Rpb24gdG8gYSBjb250ZXh0LCBvcHRpb25hbGx5IHBhcnRpYWxseSBhcHBseWluZyBhbnlcblx0Ly8gYXJndW1lbnRzLlxuXHRwcm94eTogZnVuY3Rpb24oIGZuLCBjb250ZXh0ICkge1xuXHRcdHZhciB0bXAsIGFyZ3MsIHByb3h5O1xuXG5cdFx0aWYgKCB0eXBlb2YgY29udGV4dCA9PT0gXCJzdHJpbmdcIiApIHtcblx0XHRcdHRtcCA9IGZuWyBjb250ZXh0IF07XG5cdFx0XHRjb250ZXh0ID0gZm47XG5cdFx0XHRmbiA9IHRtcDtcblx0XHR9XG5cblx0XHQvLyBRdWljayBjaGVjayB0byBkZXRlcm1pbmUgaWYgdGFyZ2V0IGlzIGNhbGxhYmxlLCBpbiB0aGUgc3BlY1xuXHRcdC8vIHRoaXMgdGhyb3dzIGEgVHlwZUVycm9yLCBidXQgd2Ugd2lsbCBqdXN0IHJldHVybiB1bmRlZmluZWQuXG5cdFx0aWYgKCAhalF1ZXJ5LmlzRnVuY3Rpb24oIGZuICkgKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIFNpbXVsYXRlZCBiaW5kXG5cdFx0YXJncyA9IHNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMiApO1xuXHRcdHByb3h5ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gZm4uYXBwbHkoIGNvbnRleHQgfHwgdGhpcywgYXJncy5jb25jYXQoIHNsaWNlLmNhbGwoIGFyZ3VtZW50cyApICkgKTtcblx0XHR9O1xuXG5cdFx0Ly8gU2V0IHRoZSBndWlkIG9mIHVuaXF1ZSBoYW5kbGVyIHRvIHRoZSBzYW1lIG9mIG9yaWdpbmFsIGhhbmRsZXIsIHNvIGl0IGNhbiBiZSByZW1vdmVkXG5cdFx0cHJveHkuZ3VpZCA9IGZuLmd1aWQgPSBmbi5ndWlkIHx8IGpRdWVyeS5ndWlkKys7XG5cblx0XHRyZXR1cm4gcHJveHk7XG5cdH0sXG5cblx0bm93OiBEYXRlLm5vdyxcblxuXHQvLyBqUXVlcnkuc3VwcG9ydCBpcyBub3QgdXNlZCBpbiBDb3JlIGJ1dCBvdGhlciBwcm9qZWN0cyBhdHRhY2ggdGhlaXJcblx0Ly8gcHJvcGVydGllcyB0byBpdCBzbyBpdCBuZWVkcyB0byBleGlzdC5cblx0c3VwcG9ydDogc3VwcG9ydCxcbiAgICAgICAgdW5pcXVlOiBmdW5jdGlvbiggcmVzdWx0cyApIHtcbiAgICAgICAgICAgIHZhciBlbGVtLFxuICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVzID0gW10sXG4gICAgICAgICAgICAgICAgICAgIGogPSAwLFxuICAgICAgICAgICAgICAgICAgICBpID0gMDtcblxuICAgICAgICAgICAgLy8gVW5sZXNzIHdlICprbm93KiB3ZSBjYW4gZGV0ZWN0IGR1cGxpY2F0ZXMsIGFzc3VtZSB0aGVpciBwcmVzZW5jZVxuICAgICAgICAgICAgaGFzRHVwbGljYXRlID0gIXN1cHBvcnQuZGV0ZWN0RHVwbGljYXRlcztcbiAgICAgICAgICAgIHNvcnRJbnB1dCA9ICFzdXBwb3J0LnNvcnRTdGFibGUgJiYgcmVzdWx0cy5zbGljZSggMCApO1xuICAgICAgICAgICAgcmVzdWx0cy5zb3J0KCBzb3J0T3JkZXIgKTtcblxuICAgICAgICAgICAgaWYgKCBoYXNEdXBsaWNhdGUgKSB7XG4gICAgICAgICAgICAgICAgICAgIHdoaWxlICggKGVsZW0gPSByZXN1bHRzW2krK10pICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggZWxlbSA9PT0gcmVzdWx0c1sgaSBdICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaiA9IGR1cGxpY2F0ZXMucHVzaCggaSApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoIGotLSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnNwbGljZSggZHVwbGljYXRlc1sgaiBdLCAxICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2xlYXIgaW5wdXQgYWZ0ZXIgc29ydGluZyB0byByZWxlYXNlIG9iamVjdHNcbiAgICAgICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vanF1ZXJ5L3NpenpsZS9wdWxsLzIyNVxuICAgICAgICAgICAgc29ydElucHV0ID0gbnVsbDtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIHZhciAkO1xuICAgIGlmICh3aW5kb3cgPT09IF9fdW5kZWZpbmVkIHx8IHdpbmRvdy5qUXVlcnkgPT09IF9fdW5kZWZpbmVkKSB7XG4gICAgICAgICQgPSBqUXVlcnk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgJCA9IHdpbmRvdy5qUXVlcnk7XG4gICAgfVxuICAgIFxuICAgIG1vZHVsZS5leHBvcnRzID0gJDtcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKCcuL01vZCcpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICB2YXIgTUVUQV9NT0RTID0gcmVxdWlyZSgnLi9tZXRhX21vZHMnKTtcclxuICAgIFxyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEFwcGxpY2FibGUgZXh0ZW5kcyBNb2QgaW1wbGllbWVudHMgQXBwbGljYWJsZSwgU2VyaWFsaXplYWJsZVxyXG4gICAgICovXHJcbiAgICB2YXIgQXBwbGljYWJsZU1vZCA9IE1vZC5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wcyBmb3IgR2dwa0VudHJ5XHJcbiAgICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAocHJvcHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIocHJvcHMpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQXBwbGljYWJsZVxyXG4gICAgICAgICAgICB0aGlzLnJlc2V0QXBwbGljYWJsZSgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYXBwbGljYWJsZSBsb2dpY1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2Vzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGFwcGxpY2FibGVcclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZXNldFxyXG4gICAgICAgICAgICB0aGlzLnJlc2V0QXBwbGljYWJsZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCFpdGVtLmluRG9tYWluT2YoK3RoaXMuZ2V0UHJvcChcIkRvbWFpblwiKSkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLldST05HX0RPTUFJTjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICghaXRlbS5oYXNSb29tRm9yKHRoaXMpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5ET01BSU5fRlVMTDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoK3RoaXMuZ2V0UHJvcChcIkxldmVsXCIpID4gaXRlbS5pdGVtX2xldmVsKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5MT1dFUl9JTFZMO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgY29ycmVjdF9ncm91cHMgPSAkLm1hcChpdGVtLm1vZHMsIGZ1bmN0aW9uIChtb2QpIHsgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLmdldFByb3AoXCJDb3JyZWN0R3JvdXBcIik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGNvcnJlY3RfZ3JvdXBzLmluZGV4T2YodGhpcy5nZXRQcm9wKFwiQ29ycmVjdEdyb3VwXCIpKSAhPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkFMUkVBRFlfUFJFU0VOVDtcclxuICAgICAgICAgICAgfSBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICgrdGhpcy5nZXRQcm9wKFwiTGV2ZWxcIikgPiAyOCAmJiBpdGVtLmluTW9kcyhNRVRBX01PRFMuTExEX01PRCkgIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5BQk9WRV9MTERfTEVWRUw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5hcHBsaWNhYmxlX2J5dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHshQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUNhY2hlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBBcHBsaWNhYmxlLlNVQ0NFU1MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmVzZXRBcHBsaWNhYmxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5VTlNDQU5ORUQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLCBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcIlJvbGxhYmxlTW9kLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGZvciBTZXJpYWxpemVhYmxlLmRlc2VyaWFsaXplXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2VyaWFsaXplOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBrbGFzczogXCJBcHBsaWNhYmxlTW9kXCIsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbdGhpcy5wcm9wc10sXHJcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogQXBwbGljYWJsZU1vZFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQcm9wKFwiTmFtZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJvbGxhYmxlQ2FjaGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFwcGxpY2FibGVDYWNoZWQoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLCAvLyBwZXIgY29udmVudGlvbiBcclxuICAgICAgICBTVUNDRVNTOiAxLCBcclxuICAgICAgICAvLyBBcHBsaWNhYmxlXHJcbiAgICAgICAgRE9NQUlOX0ZVTEw6IDIsXHJcbiAgICAgICAgQUxSRUFEWV9QUkVTRU5UOiA0LFxyXG4gICAgICAgIFdST05HX0RPTUFJTjogOCxcclxuICAgICAgICBMT1dFUl9JTFZMOiAxNixcclxuICAgICAgICBBQk9WRV9MTERfTEVWRUw6IDMyXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEFwcGxpY2FibGVNb2Q7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBBcHBsaWNhYmxlTW9kID0gcmVxdWlyZSgnLi9BcHBsaWNhYmxlTW9kJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIHZhciBHZ3BrRW50cnkgPSByZXF1aXJlKCcuLi9HZ3BrRW50cnknKTtcclxuICAgIFxyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIE1hc3Rlck1vZCBleHRlbmRzIEFwcGxpY2FibGVNb2RcclxuICAgICAqIFxyXG4gICAgICogbW9kIGZyb20gYSBtYXN0ZXJiZW5jaFxyXG4gICAgICovXHJcbiAgICB2YXIgTWFzdGVyTW9kID0gQXBwbGljYWJsZU1vZC5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChtb2RfcHJvcHMsIGJlbmNoX3Byb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKG1vZF9wcm9wcyk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmJlbmNoID0gbmV3IEdncGtFbnRyeShiZW5jaF9wcm9wcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBtb2RuYW1lIHdpdGggYmFzaWMgc3RhdHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UHJvcChcIk5hbWVcIikgKyBcclxuICAgICAgICAgICAgICAgICAgICBcIihcIiArIHRoaXMuYmVuY2guZ2V0UHJvcChcIk1hc3Rlck5hbWVTaG9ydFwiKSArIFwiIExldmVsOiBcIiArIHRoaXMuYmVuY2guZ2V0UHJvcChcIk1hc3RlckxldmVsXCIpICsgXCIpXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhcHBsaWNhYmxlIGxvZ2ljXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdmFyIGJhc2VfaXRlbV9jbGFzc2VzO1xyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBiYXNlX2l0ZW1fY2xhc3NlcyA9IHRoaXMuYmVuY2gudmFsdWVBc0FycmF5KFwiQmFzZUl0ZW1DbGFzc2VzS2V5c1wiKTtcclxuICAgICAgICAgICAgaWYgKGJhc2VfaXRlbV9jbGFzc2VzLmxlbmd0aCA+IDAgJiYgYmFzZV9pdGVtX2NsYXNzZXMuaW5kZXhPZigraXRlbS5lbnRyeS5nZXRQcm9wKFwiSXRlbUNsYXNzXCIpKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IE1hc3Rlck1vZC5BUFBMSUNBQkxFX0JZVEUuV1JPTkdfSVRFTUNMQVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBncmVwIE1hc3Rlck1vZHMgYW5kIHNldCBmYWlsdXJlIGlmIHdlIGNhbnQgbXVsdGltb2RcclxuICAgICAgICAgICAgaWYgKCQuZ3JlcChpdGVtLm1vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2QgaW5zdGFuY2VvZiBNYXN0ZXJNb2Q7XHJcbiAgICAgICAgICAgIH0pLmxlbmd0aCA+IDAgJiYgaXRlbS5pbk1vZHMoTWFzdGVyTW9kLk1FVEFNT0QuTVVMVElNT0QpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gTWFzdGVyTW9kLkFQUExJQ0FCTEVfQllURS5OT19NVUxUSU1PRDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIFNVQ0NFU1MgQml0IGZyb20gc3VwZXIgaWYgYWRkaXRpb25hbCBmYWlsdXJlIGJpdHMgc2V0XHJcbiAgICAgICAgICAgIGlmICgodGhpcy5hcHBsaWNhYmxlX2J5dGUgJiBBcHBsaWNhYmxlLlNVQ0NFU1MpICYmICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA+IEFwcGxpY2FibGUuU1VDQ0VTUykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgXj0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNlcmlhbGl6ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAga2xhc3M6IFwiTWFzdGVyTW9kXCIsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbdGhpcy5wcm9wcywgdGhpcy5iZW5jaC5wcm9wc10sXHJcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogTWFzdGVyTW9kXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIE1hc3Rlck1vZC5BUFBMSUNBQkxFX0JZVEUsIE1hc3Rlck1vZC5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXCJNYXN0ZXJNb2QuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBNYXN0ZXJNb2QuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEFwcGxpY2FibGVNb2RcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsIC8vIHBlciBjb252ZW50aW9uIFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsIFxyXG4gICAgICAgIERPTUFJTl9GVUxMOiAyLFxyXG4gICAgICAgIEFMUkVBRFlfUFJFU0VOVDogNCxcclxuICAgICAgICBXUk9OR19ET01BSU46IDgsXHJcbiAgICAgICAgTE9XRVJfSUxWTDogMTYsXHJcbiAgICAgICAgQUJPVkVfTExEX0xFVkVMOiAzMixcclxuICAgICAgICAvLyBNYXN0ZXJNb2RcclxuICAgICAgICBXUk9OR19JVEVNQ0xBU1M6IDY0LFxyXG4gICAgICAgIE5PX01VTFRJTU9EOiAxMjhcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1hc3Rlck1vZC5NRVRBTU9EID0gcmVxdWlyZSgnLi9tZXRhX21vZHMnKTtcclxuICAgIFxyXG4gICAgLy8gdGFibGUgYGNyYWZ0aW5nYmVuY2hvcHRpb25zYFxyXG4gICAgTWFzdGVyTW9kLmNyYWZ0aW5nYmVuY2hvcHRpb25zID0gbnVsbDtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNYXN0ZXJNb2Q7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgcmVxdWlyZSgnLi4vY29uY2VybnMvQXJyYXknKTtcclxuICAgIFxyXG4gICAgdmFyIEdncGtFbnRyeSA9IHJlcXVpcmUoJy4uL0dncGtFbnRyeScpO1xyXG4gICAgdmFyIFN0YXQgPSByZXF1aXJlKCcuLi9TdGF0Jyk7XHJcbiAgICB2YXIgVmFsdWVSYW5nZSA9IHJlcXVpcmUoJy4uL1ZhbHVlUmFuZ2UnKTtcclxuICAgIFxyXG4gICAgaWYgKCQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBleHRlbmRzIEdncGtFbnRyeSBpbXBsZW1lbnRzIExvY2FsaXplYWJsZVxyXG4gICAgICovXHJcbiAgICB2YXIgTW9kID0gR2dwa0VudHJ5LmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKHByb3BzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzUHJlZml4OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzVHlwZShcInByZWZpeFwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzU3VmZml4OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzVHlwZShcInN1ZmZpeFwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzUHJlbWFkZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc1R5cGUoXCJwcmVtYWRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNUeXBlOiBmdW5jdGlvbiAodHlwZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gK3RoaXMuZ2V0UHJvcChcIkdlbmVyYXRpb25UeXBlXCIpID09PSBNb2QuTU9EX1RZUEVbdHlwZS50b1VwcGVyQ2FzZSgpXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzQWZmaXg6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNQcmVmaXgoKSB8fCB0aGlzLmlzU3VmZml4KCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpbXBsaWNpdENhbmRpZGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc1ByZW1hZGUoKSBcclxuICAgICAgICAgICAgICAgICAgICB8fCB0aGlzLmlzVHlwZShcInZhYWxcIikgXHJcbiAgICAgICAgICAgICAgICAgICAgfHwgdGhpcy5pc1R5cGUoXCJlbmNoYW50bWVudFwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheTxTdGF0Pn0gYWxsIHN0YXRzIGZyb20gdGhpcyBtb2RcclxuICAgICAgICAgKi9cclxuICAgICAgICBzdGF0c0pvaW5lZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIHJldHVybiAkLm1hcCh0aGlzLnZhbHVlQXNBcnJheShcIlN0YXRzXCIpLCBmdW5jdGlvbiAocm93LCBpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocm93LnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKSA9PT0gJ251bGwnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY29udGludWVcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIHN0YXQgPSBuZXcgU3RhdChNb2QuYWxsX3N0YXRzW3Jvd10pO1xyXG4gICAgICAgICAgICAgICAgc3RhdC52YWx1ZXMgPSBuZXcgVmFsdWVSYW5nZSgrdGhhdC5nZXRQcm9wKFwiU3RhdFwiICsgKGkgKyAxKSArIFwiTWluXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArdGhhdC5nZXRQcm9wKFwiU3RhdFwiICsgKGkgKyAxKSArIFwiTWF4XCIpKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogdHJhbnNsYXRlcyB0aGUgc3RhdHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0c0pvaW5lZCgpO1xyXG4gICAgICAgICAgICAvLyBUT0RPIG1heWJlIGNoZWNrIGJlZm9yZSBsb2NhbGl6aW5nIGNhdXNlIHVuaXF1ZSBvbiBsb25nIHN0cmluZ3MgbWlnaHRcclxuICAgICAgICAgICAgLy8gYmUgaW5lZmZpY2llbnQuIG9uIHRoZSBvdGhlciBoYW5kIHdlIGFsbW9zdCBhbHdheXMgaGFuZGxlIDwgMTAgbW9kc1xyXG4gICAgICAgICAgICByZXR1cm4gJC51bmlxdWUoJC5tYXAoc3RhdHMsIGZ1bmN0aW9uIChzdGF0KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3RhdC52YWx1ZXMuaXNaZXJvKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBzdGF0LnQoc3RhdHMsIE1vZC5sb2NhbGl6YXRpb24pO1xyXG4gICAgICAgICAgICB9KSkuam9pbihcIlxcblwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHRyYW5zbGF0ZXMgdGhlIGNvcnJlY3QgZ3JvdXBcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNvcnJlY3RHcm91cFRyYW5zbGF0ZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIGNvcnJlY3RfZ3JvdXAgPSB0aGlzLmdldFByb3AoXCJDb3JyZWN0R3JvdXBcIik7XHJcbiAgICAgICAgICAgIHZhciB0cmFuc2xhdGVkID0gTW9kLmNvcnJlY3RfZ3JvdXBfbG9jYWxpemF0aW9uW2NvcnJlY3RfZ3JvdXBdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRyYW5zbGF0ZWQgPT09IF9fdW5kZWZpbmVkIHx8IHRyYW5zbGF0ZWQgPT09IFwiXCIpIHtcclxuICAgICAgICAgICAgICAgIC8vIERlQ2FtZWxpemVcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb3JyZWN0X2dyb3VwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluc2VydCBhIHNwYWNlIGJlZm9yZSBhbGwgY2Fwc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKFtBLVpdKS9nLCAnICQxJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB0cmFuc2xhdGVkO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc3RyaW5nIGlkZW50aWZpZXIgb2YgdGhlIGdlbmVyYXRpb24gdHlwZVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbW9kVHlwZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIHJldHVybiAkLm1hcChNb2QuTU9EX1RZUEUsIGZ1bmN0aW9uIChtb2RfdHlwZSwgdHlwZV9uYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobW9kX3R5cGUgPT09ICt0aGF0LmdldFByb3AoXCJHZW5lcmF0aW9uVHlwZVwiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0eXBlX25hbWUudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQcm9wKFwiTmFtZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHVuaXF1ZSBpZCBmb3IgZG9tXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBkb21JZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gTW9kLmRvbUlkKHRoaXMuZ2V0UHJvcChcIlJvd3NcIikpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBNb2QuZG9tSWQgPSBmdW5jdGlvbiAoaWQpIHtcclxuICAgICAgICByZXR1cm4gXCJtb2RfXCIgKyBpZDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1vZC5NT0RfVFlQRSA9IHtcclxuICAgICAgICBQUkVGSVg6IDEsXHJcbiAgICAgICAgU1VGRklYOiAyLFxyXG4gICAgICAgIFBSRU1BREU6IDMsXHJcbiAgICAgICAgTkVNRVNJUzogNCxcclxuICAgICAgICBWQUFMOiA1LFxyXG4gICAgICAgIEJMT09ETElORVM6IDYsXHJcbiAgICAgICAgVE9STUVOVDogNyxcclxuICAgICAgICBURU1QRVNUOiA4LFxyXG4gICAgICAgIFRBTElTTUFOOiA5LFxyXG4gICAgICAgIEVOQ0hBTlRNRU5UOiAxMFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgTW9kLkRPTUFJTiA9IHtcclxuICAgICAgICBJVEVNOiAxLFxyXG4gICAgICAgIEZMQVNLOiAyLFxyXG4gICAgICAgIE1PTlNURVI6IDMsXHJcbiAgICAgICAgU1RST05HQk9YOiA0LFxyXG4gICAgICAgIE1BUDogNSxcclxuICAgICAgICBTVEFOQ0U6IDksXHJcbiAgICAgICAgTUFTVEVSOiAxMCxcclxuICAgICAgICBKRVdFTDogMTFcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1vZC5sb2NhbGl6YXRpb24gPSBudWxsO1xyXG4gICAgTW9kLmNvcnJlY3RfZ3JvdXBfbG9jYWxpemF0aW9uID0gbnVsbDtcclxuICAgIE1vZC5hbGxfc3RhdHMgPSBudWxsO1xyXG4gICAgXHJcbiAgICAvLyB0YWJsZSBgbW9kc2BcclxuICAgIHRoaXMubW9kcyA9IG51bGw7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTW9kO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4uL0luaGVyaXRhbmNlJyk7XHJcbiAgICB2YXIgU2VyaWFsaXplYWJsZSA9IHJlcXVpcmUoJy4uL1NlcmlhbGl6ZWFibGUnKTtcclxuICAgIFxyXG4gICAgdmFyIE1vZEZhY3RvcnkgPSBDbGFzcy5leHRlbmQoe30pO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIEBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zMzYyNDcxL2hvdy1jYW4taS1jYWxsLWEtamF2YXNjcmlwdC1jb25zdHJ1Y3Rvci11c2luZy1jYWxsLW9yLWFwcGx5XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc2VyaWFsaXplZFxyXG4gICAgICogQHJldHVybnMge01vZEZhY3RvcnlfTDEuTW9kRmFjdG9yeS5kZXNlcmlhbGl6ZS5GYWN0b3J5RnVuY3Rpb259XHJcbiAgICAgKi9cclxuICAgIE1vZEZhY3RvcnkuZGVzZXJpYWxpemUgPSBTZXJpYWxpemVhYmxlLmRlc2VyaWFsaXplO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZEZhY3Rvcnk7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBBcHBsaWNhYmxlTW9kID0gcmVxdWlyZSgnLi9BcHBsaWNhYmxlTW9kJyk7XHJcbiAgICB2YXIgU3Bhd25hYmxlID0gcmVxdWlyZSgnLi4vU3Bhd25hYmxlJyk7XHJcbiAgICBcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBSb2xsYWJsZU1vZCBleHRlbmRzIEFwcGxpY2FibGVNb2QgaW1wbGllbWVudHMgU3Bhd25hYmxlXHJcbiAgICAgKi9cclxuICAgIHZhciBSb2xsYWJsZU1vZCA9IEFwcGxpY2FibGVNb2QuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcHJvcHMgZm9yIEdncGtFbnRyeVxyXG4gICAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKHByb3BzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFNwYXduYWJsZVxyXG4gICAgICAgICAgICB0aGlzLnJlc2V0U3Bhd25hYmxlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLnJvbGxhYmxlID0gUm9sbGFibGVNb2QuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBSb2xsYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUsIFJvbGxhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcIlJvbGxhYmxlTW9kLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGNoZWNrcyBpZiBzcGF3bmFibGUgYW5kIHNldHMgdGhlIHNwYXdud2VpZ2h0XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2RDb250YWluZXJ9IG1vZF9jb250YWluZXJcclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc3Bhd25hYmxlT246IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IFNwYXduYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBTcGF3bmFibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHNwYXdud2VpZ2h0X3RhZ3MgPSAkKHRoaXMudmFsdWVBc0FycmF5KFwiU3Bhd25XZWlnaHRfVGFnc0tleXNcIikpLmZpbHRlcihtb2RfY29udGFpbmVyLmdldFRhZ3MoKSkudG9BcnJheSgpO1xyXG4gICAgICAgICAgICAvLyByZXNldFxyXG4gICAgICAgICAgICB0aGlzLnJlc2V0U3Bhd25hYmxlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3Bhd253ZWlnaHRfdGFncy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3Bhd25hYmxlX2J5dGUgPSBSb2xsYWJsZU1vZC5TUEFXTkFCTEVfQllURS5OT19NQVRDSElOR19UQUdTO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBmaXJzdCBzcGF3bndlaWdodF90YWcgdG8gIG1hdGNoIGFueSBpdGVtX3RhZyBnZXRzIHRvIGNob29zZVxyXG4gICAgICAgICAgICAvLyB0aGUgc3Bhd253ZWlnaHRcclxuICAgICAgICAgICAgdGhpcy5zcGF3bndlaWdodCA9IHRoaXMudmFsdWVBc0FycmF5KFwiU3Bhd25XZWlnaHRfVmFsdWVzXCIpW3RoaXMudmFsdWVBc0FycmF5KFwiU3Bhd25XZWlnaHRfVGFnc0tleXNcIikuaW5kZXhPZihzcGF3bndlaWdodF90YWdzWzBdKV07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodGhpcy5zcGF3bndlaWdodCA8PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNwYXdud2VpZ2h0ID0gMDtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3Bhd25hYmxlX2J5dGUgfD0gUm9sbGFibGVNb2QuU1BBV05BQkxFX0JZVEUuU1BBV05XRUlHSFRfWkVSTztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLnNwYXduYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNwYXduYWJsZV9ieXRlID0gU3Bhd25hYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5zcGF3bmFibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzcGF3bmNoYW5jZSBpbiBbJV1cclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gcHJlY2lzaW9uXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBodW1hblNwYXduY2hhbmNlOiBmdW5jdGlvbiAocHJlY2lzaW9uKSB7XHJcbiAgICAgICAgICAgIGlmIChwcmVjaXNpb24gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSAyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgc3Bhd25jaGFuY2UgPSAwLjA7XHJcblxyXG4gICAgICAgICAgICAvLyBzcGF3bmNoYW5jZSBpcyBiYXNpY2FsbHkgemVybyBpZiBpdHMgbm90IGFwcGxpY2FibGVcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3Bhd25jaGFuY2UgIT09IG51bGwgJiYgdGhpcy5hcHBsaWNhYmxlQ2FjaGVkKCkpIHtcclxuICAgICAgICAgICAgICAgIHNwYXduY2hhbmNlID0gdGhpcy5zcGF3bmNoYW5jZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIChzcGF3bmNoYW5jZSAqIDEwMCkudG9GaXhlZChwcmVjaXNpb24pICsgXCIlXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNldFNwYXduYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLnNwYXdud2VpZ2h0ID0gMDtcclxuICAgICAgICAgICAgdGhpcy5zcGF3bmNoYW5jZSA9IG51bGw7XHJcbiAgICAgICAgICAgIHRoaXMuc3Bhd25hYmxlX2J5dGUgPSBTcGF3bmFibGUuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3Bhd25hYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5zcGF3bmFibGVfYnl0ZSwgUm9sbGFibGVNb2QuU1BBV05BQkxFX0JZVEUsIFJvbGxhYmxlTW9kLlNQQVdOQUJMRV9CWVRFLlNVQ0NFU1MsIFwiUm9sbGFibGVNb2Quc3Bhd25hYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzcGF3bmFibGVDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLnNwYXduYWJsZV9ieXRlLCBTcGF3bmFibGUuU1VDQ0VTUyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByb2xsYWJsZU9uOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgICAgICB0aGlzLnJvbGxhYmxlID0gdGhpcy5hcHBsaWNhYmxlVG8obW9kX2NvbnRhaW5lcikgJiYgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNwYXduYWJsZU9uKG1vZF9jb250YWluZXIpIDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJvbGxhYmxlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gZm9yIFNlcmlhbGl6ZWFibGUuZGVzZXJpYWxpemVcclxuICAgICAgICAgKi9cclxuICAgICAgICBzZXJpYWxpemU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGtsYXNzOiBcIlJvbGxhYmxlTW9kXCIsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbdGhpcy5wcm9wc10sXHJcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogUm9sbGFibGVNb2RcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJvbGxhYmxlQ2FjaGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNwYXduYWJsZUNhY2hlZCgpICYmIHRoaXMuYXBwbGljYWJsZUNhY2hlZCgpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBSb2xsYWJsZU1vZC5TUEFXTkFCTEVfQllURSA9IHtcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsIC8vIHBlciBjb252ZW50aW9uIFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9fTUFUQ0hJTkdfVEFHUzogMixcclxuICAgICAgICBTUEFXTldFSUdIVF9aRVJPOiA0XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBSb2xsYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUgPSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURTtcclxuICAgIFxyXG4gICAgUm9sbGFibGVNb2QuVU5TQ0FOTkVEID0gMDtcclxuICAgIFJvbGxhYmxlTW9kLlNVQ0NFU1MgPSB0cnVlO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFJvbGxhYmxlTW9kO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qXG4gKiBjb2xsZWN0aW9uIG9mIG1ldGFtb2RzIHRoYXQgYWZmZWN0IHRoZSBjcmFmdGluZyBwcm9jZXNzXG4gKi9cbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgXG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICAgIExPQ0tFRF9QUkVGSVhFUzogNDM0MSxcbiAgICAgICAgTE9DS0VEX1NVRkZJWEVTOiA0MzQyLFxuICAgICAgICBOT19BVFRBQ0tfTU9EUzogNDM0MyxcbiAgICAgICAgTk9fQ0FTVEVSX01PRFM6IDQzNDQsXG4gICAgICAgIE1VTFRJTU9EOiA0MzQ1LFxuICAgICAgICBMTERfTU9EOiA0Mjg4XG4gICAgfTtcbn0pLmNhbGwodGhpcyk7Il19
