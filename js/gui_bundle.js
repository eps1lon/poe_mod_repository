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
    var Mod = require('../mods/Mod');
    
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
},{"../ModContainers/Item":10,"../jquery/jquery_node":40,"../mods/MasterMod":42,"../mods/Mod":43,"./ModGenerator":22}],22:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9ndWkuanMiLCJqcy9saWJzL0FwcGxpY2FibGUuanMiLCJqcy9saWJzL0RhdGFEZXBlbmRlbmN5LmpzIiwianMvbGlicy9FeGNlcHRpb25zL05vdEZvdW5kRXhjZXB0aW9uLmpzIiwianMvbGlicy9HZ3BrRW50cnkuanMiLCJqcy9saWJzL0hhc2hiYW5nLmpzIiwianMvbGlicy9Jbmhlcml0YW5jZS5qcyIsImpzL2xpYnMvTG9jYWxpemF0aW9uLmpzIiwianMvbGlicy9NZXRhRGF0YS5qcyIsImpzL2xpYnMvTW9kQ29udGFpbmVycy9JdGVtLmpzIiwianMvbGlicy9Nb2RDb250YWluZXJzL0l0ZW1JbXBsaWNpdHMuanMiLCJqcy9saWJzL01vZENvbnRhaW5lcnMvTW9kQ29udGFpbmVyLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0FsY2hlbXkuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvQWx0ZXJhdGlvbi5qcyIsImpzL2xpYnMvTW9kR2VuZXJhdG9ycy9BdWdtZW50LmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0NoYW9zLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0N1cnJlbmN5LmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0VuY2hhbnRtZW50YmVuY2guanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvRXhhbHRlZC5qcyIsImpzL2xpYnMvTW9kR2VuZXJhdG9ycy9JdGVtU2hvd2Nhc2UuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvTWFzdGVyYmVuY2guanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvTW9kR2VuZXJhdG9yLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL01vZEdlbmVyYXRvckZhY3RvcnkuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvUmVnYWwuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvU2NvdXJpbmcuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvVGFsaXNtYW4uanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvVHJhbnNtdXRlLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL1ZhYWwuanMiLCJqcy9saWJzL1BhdGguanMiLCJqcy9saWJzL1NlcmlhbGl6ZWFibGUuanMiLCJqcy9saWJzL1NwYXduYWJsZS5qcyIsImpzL2xpYnMvU3RhdC5qcyIsImpzL2xpYnMvVmFsdWVSYW5nZS5qcyIsImpzL2xpYnMvY29uY2VybnMvQXJyYXkuanMiLCJqcy9saWJzL2NvbmNlcm5zL0J5dGVTZXQuanMiLCJqcy9saWJzL2NvbmNlcm5zL01hdGguanMiLCJqcy9saWJzL2NvbmNlcm5zL051bWJlci5qcyIsImpzL2xpYnMvY29uY2VybnMvT2JqZWN0LmpzIiwianMvbGlicy9jb25jZXJucy9TdHJpbmcuanMiLCJqcy9saWJzL2pxdWVyeS9qcXVlcnlfbm9kZS5qcyIsImpzL2xpYnMvbW9kcy9BcHBsaWNhYmxlTW9kLmpzIiwianMvbGlicy9tb2RzL01hc3Rlck1vZC5qcyIsImpzL2xpYnMvbW9kcy9Nb2QuanMiLCJqcy9saWJzL21vZHMvTW9kRmFjdG9yeS5qcyIsImpzL2xpYnMvbW9kcy9Sb2xsYWJsZU1vZC5qcyIsImpzL2xpYnMvbW9kcy9tZXRhX21vZHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzd6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcbi8qIVxyXG4gKiBQb0UgTW9kIFJlcG9zaXRvcnlcclxuICogQnkgU2ViYXN0aWFuIFNpbGJlcm1hbm5cclxuICogTUlUIExpY2Vuc2VkLlxyXG4gKi9cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgaWYgKHdpbmRvdyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwibmVlZCB3aW5kb3cgY29udGV4dFwiKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vbm9kZVxyXG4gICAgdmFyIE1vZEdlbmVyYXRvckZhY3RvcnkgPSByZXF1aXJlKCcuL2xpYnMvTW9kR2VuZXJhdG9ycy9Nb2RHZW5lcmF0b3JGYWN0b3J5Jyk7XHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9Nb2RHZW5lcmF0b3JzL01vZEdlbmVyYXRvcicpO1xyXG4gICAgdmFyIE1hc3RlcmJlbmNoICAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvTW9kR2VuZXJhdG9ycy9NYXN0ZXJiZW5jaCcpO1xyXG4gICAgdmFyIEl0ZW0gICAgICAgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgTW9kICAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9tb2RzL01vZCcpO1xyXG4gICAgdmFyIE1vZEZhY3RvcnkgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvbW9kcy9Nb2RGYWN0b3J5Jyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZU1vZCAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9tb2RzL0FwcGxpY2FibGVNb2QnKTtcclxuICAgIHZhciBNYXN0ZXJNb2QgICAgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL21vZHMvTWFzdGVyTW9kJyk7XHJcbiAgICB2YXIgU3Bhd25hYmxlICAgICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9TcGF3bmFibGUnKTtcclxuICAgIHZhciBEYXRhRGVwZW5kZW5jeSAgICAgID0gcmVxdWlyZSgnLi9saWJzL0RhdGFEZXBlbmRlbmN5Jyk7XHJcbiAgICB2YXIgTG9jYWxpemF0aW9uICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9Mb2NhbGl6YXRpb24nKTtcclxuICAgIHZhciBIYXNoYmFuZyAgICAgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL0hhc2hiYW5nJyk7XHJcbiAgICB2YXIgQnl0ZVNldCAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICB2YXIgTm90Rm91bmRFeGNlcHRpb24gICA9IHJlcXVpcmUoJy4vbGlicy9FeGNlcHRpb25zL05vdEZvdW5kRXhjZXB0aW9uJyk7XHJcbiAgICBcclxuICAgIHJlcXVpcmUoJy4vbGlicy9jb25jZXJucy9BcnJheScpO1xyXG4gICAgcmVxdWlyZSgnLi9saWJzL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIHJlcXVpcmUoJy4vbGlicy9jb25jZXJucy9NYXRoJyk7XHJcbiAgICByZXF1aXJlKCcuL2xpYnMvY29uY2VybnMvTnVtYmVyJyk7XHJcbiAgICByZXF1aXJlKCcuL2xpYnMvY29uY2VybnMvT2JqZWN0Jyk7XHJcbiAgICByZXF1aXJlKCcuL2xpYnMvY29uY2VybnMvU3RyaW5nJyk7XHJcbiAgICBcclxuICAgIC8vIFwidGFibGVzXCJcclxuICAgIHZhciBtb2RzID0gW10sXHJcbiAgICAgICAgdGFncyA9IFtdLFxyXG4gICAgICAgIGJhc2VpdGVtdHlwZXMgPSBbXSxcclxuICAgICAgICBzdGF0cyA9IFtdO1xyXG4gICAgXHJcbiAgICB2YXIgVEFHUyA9IHt9O1xyXG4gICAgXHJcbiAgICAvLyB0ZW1wbGF0ZSBtZXRob2RzXHJcbiAgICB2YXIgY3JlYXRlX2Zyb21fdGVtcGxhdGUgPSBmdW5jdGlvbiAoc2VsZWN0b3IsIGNvbnRleHQpIHtcclxuICAgICAgICBpZiAoY29udGV4dCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHNlbGVjdG9yID0gY29udGV4dC5zZWxlY3RvciArIFwiIFwiICsgc2VsZWN0b3I7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiAkKHNlbGVjdG9yICsgXCIudGVtcGxhdGVcIikuY2xvbmUodHJ1ZSkucmVtb3ZlQ2xhc3MoXCJ0ZW1wbGF0ZVwiKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIGFzc2VydCBiYXNlaXRlbSB0eXBlb2YgQmFzZUl0ZW1cclxuICAgIHZhciBkaXNwbGF5X2Jhc2VpdGVtID0gZnVuY3Rpb24gKGJhc2VpdGVtLCBzZWxlY3Rvcikge1xyXG4gICAgICAgIC8vIGFzc2VydCBiYXNlaXRlbSB0eXBlb2YgQmFzZUl0ZW1cclxuICAgICAgICAvLyByZW1vdmUgb2xkIGl0ZW1ib3hcclxuICAgICAgICAkKHNlbGVjdG9yKS5lbXB0eSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghKGJhc2VpdGVtIGluc3RhbmNlb2YgSXRlbSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgJGl0ZW1ib3ggPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcIi5pdGVtYm94XCIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHJhcml0eVxyXG4gICAgICAgIHZhciByYXJpdHlfaWRlbnQgPSBiYXNlaXRlbS5yYXJpdHlJZGVudCgpO1xyXG4gICAgICAgICRpdGVtYm94LmFkZENsYXNzKHJhcml0eV9pZGVudCk7XHJcbiAgICAgICAgJChcIiNpdGVtX3Jhcml0aWVzIG9wdGlvblt2YWx1ZT0nXCIgKyByYXJpdHlfaWRlbnQudG9VcHBlckNhc2UoKSArIFwiJ11cIikucHJvcChcInNlbGVjdGVkXCIsIHRydWUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciAkc3RhdHNncm91cF90ZW1wbGF0ZSA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwiLml0ZW1ib3gtc3RhdHNncm91cFwiLCAkaXRlbWJveCk7XHJcbiAgICAgICAgdmFyICRzdGF0c2dyb3VwID0gJHN0YXRzZ3JvdXBfdGVtcGxhdGUuY2xvbmUodHJ1ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gbmFtZVxyXG4gICAgICAgICQoXCIuaXRlbWJveGhlYWRlciAuaXRlbU5hbWVcIiwgJGl0ZW1ib3gpLnRleHQoYmFzZWl0ZW0uaXRlbU5hbWUoKSk7XHJcbiAgICAgICAgJChcIi5pdGVtYm94aGVhZGVyIC5iYXNlTmFtZVwiLCAkaXRlbWJveCkudGV4dChiYXNlaXRlbS5iYXNlTmFtZSgpKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBpdGVtX2NsYXNzXHJcbiAgICAgICAgJHN0YXRzZ3JvdXAuYWRkQ2xhc3MoXCJtZXRhX2RhdGFcIik7XHJcbiAgICAgICAgJHN0YXRzZ3JvdXAuYXBwZW5kKGJhc2VpdGVtLml0ZW1jbGFzc0lkZW50KCkudG9Mb3dlckNhc2UoKS51Y2ZpcnN0KCkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHRhZ3NcclxuICAgICAgICAkc3RhdHNncm91cC5hcHBlbmQoXCI8YnI+XCIsICQubWFwKGJhc2VpdGVtLmdldFRhZ3NXaXRoUHJvcHModGFncyksIGZ1bmN0aW9uIChwcm9wcykge1xyXG4gICAgICAgICAgICByZXR1cm4gcHJvcHMuSWQudW5kZXJzY29yZVRvSHVtYW4oKTtcclxuICAgICAgICB9KS5qb2luKFwiLCBcIikpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHNlcFxyXG4gICAgICAgICQoXCIuaXRlbWJveC1zdGF0c1wiLCAkaXRlbWJveCkuYXBwZW5kKCRzdGF0c2dyb3VwKTtcclxuICAgICAgICAkc3RhdHNncm91cCA9ICRzdGF0c2dyb3VwX3RlbXBsYXRlLmNsb25lKHRydWUpO1xyXG4gICAgICAgICRzdGF0c2dyb3VwLmFkZENsYXNzKFwibG9jYWxTdGF0c1wiKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBzdGF0c1xyXG4gICAgICAgICQuZWFjaChiYXNlaXRlbS5sb2NhbFN0YXRzKCksIGZ1bmN0aW9uIChzdGF0X2Rlc2MsIHZhbHVlKSB7XHJcbiAgICAgICAgICAgICRzdGF0c2dyb3VwLmFwcGVuZChcIjxicj5cIiwgc3RhdF9kZXNjLCBcIjogXCIsIFwiPHNwYW4gY2xhc3M9J3RleHQtdmFsdWUnPlwiICsgdmFsdWUgKyBcIjwvc3Bhbj5cIik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gc2VwXHJcbiAgICAgICAgaWYgKCQudHJpbSgkc3RhdHNncm91cC50ZXh0KCkpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAkKFwiLml0ZW1ib3gtc3RhdHNcIiwgJGl0ZW1ib3gpLmFwcGVuZCgkc3RhdHNncm91cCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgICRzdGF0c2dyb3VwID0gJHN0YXRzZ3JvdXBfdGVtcGxhdGUuY2xvbmUodHJ1ZSk7XHJcbiAgICAgICAgJHN0YXRzZ3JvdXAuYWRkQ2xhc3MoXCJyZXF1aXJlbWVudHNcIik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUmVxdWlyZW1lbnRzXHJcbiAgICAgICAgJHN0YXRzZ3JvdXAuYXBwZW5kKFwiUmVxdWlyZXMgXCIsICQubWFwKGJhc2VpdGVtLnJlcXVpcmVtZW50cygpLCBmdW5jdGlvbiAocmVxdWlyZW1lbnQsIGtleSkge1xyXG4gICAgICAgICAgICByZXR1cm4ga2V5ICsgXCIgPHNwYW4gY2xhc3M9J3RleHQtdmFsdWUnPlwiICsgcmVxdWlyZW1lbnQgKyBcIjwvc3Bhbj5cIjtcclxuICAgICAgICB9KS5qb2luKFwiLCBcIiksIFwiPGJyPlwiKTtcclxuICAgICAgICAvLyBpbHZsXHJcbiAgICAgICAgJHN0YXRzZ3JvdXAuYXBwZW5kKGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwiLmlsdmxcIiwgJGl0ZW1ib3gpLnZhbChiYXNlaXRlbS5pdGVtX2xldmVsKSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgJC5lYWNoKFtcImltcGxpY2l0c1wiLCBcImFmZml4ZXNcIl0sIGZ1bmN0aW9uIChfLCBtb2RHZXR0ZXIpIHtcclxuICAgICAgICAgICAgLy8gc2VwXHJcbiAgICAgICAgICAgIGlmICgkLnRyaW0oJHN0YXRzZ3JvdXAudGV4dCgpKS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICQoXCIuaXRlbWJveC1zdGF0c1wiLCAkaXRlbWJveCkuYXBwZW5kKCRzdGF0c2dyb3VwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJHN0YXRzZ3JvdXAgPSAkc3RhdHNncm91cF90ZW1wbGF0ZS5jbG9uZSgpO1xyXG4gICAgICAgICAgICAkc3RhdHNncm91cC5hZGRDbGFzcyhtb2RHZXR0ZXIpO1xyXG5cclxuICAgICAgICAgICAgdmFyICRtb2RzID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCJ1bC5tb2RzXCIsICRpdGVtYm94KTtcclxuICAgICAgICAgICAgJG1vZHMuYWRkQ2xhc3MobW9kR2V0dGVyKTtcclxuXHJcbiAgICAgICAgICAgIC8vIGFmZml4ZXNcclxuICAgICAgICAgICAgJC5lYWNoKGJhc2VpdGVtW1wiZ2V0XCIgKyBtb2RHZXR0ZXIudWNmaXJzdCgpXSgpLCBmdW5jdGlvbiAoaSwgbW9kKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgJG1vZCA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwibGkubW9kXCIsICRtb2RzKTtcclxuXHJcbiAgICAgICAgICAgICAgICAkbW9kLmRhdGEoXCJwcmltYXJ5XCIsIG1vZC5nZXRQcm9wKFwiUm93c1wiKSk7XHJcbiAgICAgICAgICAgICAgICAkbW9kLmFkZENsYXNzKFwibW9kLXR5cGUtXCIgKyBtb2QubW9kVHlwZSgpKTtcclxuICAgICAgICAgICAgICAgICRtb2QuYWRkQ2xhc3MobW9kLnNlcmlhbGl6ZSgpLmtsYXNzKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJChcIi5uYW1lXCIsICRtb2QpLnRleHQobW9kLm5hbWUoKSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICQuZWFjaChtb2QudCgpLnNwbGl0KFwiXFxuXCIpLCBmdW5jdGlvbiAoaiwgc3RhdF90ZXh0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgJChcInVsLnN0YXRzXCIsICRtb2QpLmFwcGVuZChcIjxsaT5cIiArIHN0YXRfdGV4dCArIFwiPC9saT5cIik7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAkbW9kLmFwcGVuZFRvKCRtb2RzKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoJChcIi5zdGF0cyBsaVwiLCAkbW9kcykubGVuZ3RoID4gMCB8fCBmYWxzZSkge1xyXG4gICAgICAgICAgICAgICAgJG1vZHMuYXBwZW5kVG8oJHN0YXRzZ3JvdXApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIHNlcFxyXG4gICAgICAgIGlmICgkLnRyaW0oJHN0YXRzZ3JvdXAudGV4dCgpKS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgJChcIi5pdGVtYm94LXN0YXRzXCIsICRpdGVtYm94KS5hcHBlbmQoJHN0YXRzZ3JvdXApO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyQoXCIuaXRlbWJveC1zdGF0c1wiLCAkaXRlbWJveCkuYXBwZW5kKCRzZXBhcmF0b3JfdGVtcGxhdGUuY2xvbmUoKSlcclxuICAgICAgICAvLyRzdGF0c2dyb3VwID0gJHN0YXRzZ3JvdXBfdGVtcGxhdGUuY2xvbmUoKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBhcHBlbmQgbmV3IG9uZVxyXG4gICAgICAgIHJldHVybiAkKFwiI3VzZWRfYmFzZWl0ZW1cIikuYXBwZW5kKCRpdGVtYm94KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHZhciBkaXNwbGF5X2F2YWlsYWJsZV9tb2RzID0gZnVuY3Rpb24gKG1vZF9nZW5lcmF0b3IsIGJhc2VpdGVtKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2cobW9kX2dlbmVyYXRvciwgXCJAXCIsIGJhc2VpdGVtLCBcIj9cIik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gc2hvd24gZ3JvdXBzXHJcbiAgICAgICAgdmFyICRjbGlja2VkX2dyb3VwcyA9ICQoXCIjYXZhaWxhYmxlX21vZHMgdGJvZHkuY2xpY2tlZFwiKTtcclxuICAgICAgICB2YXIgd2FzX2V4cGFuZGVkID0gJChcInRhYmxlLm1vZHNcIikuaGFzQ2xhc3MoXCJleHBhbmRlZFwiKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgIC8vIGV4dGVuZHMgTW9kR2VuZXJhdG9yIGltcGxlbWVudHMgQXBwbGljYWJsZVxyXG4gICAgICAgIGlmICghKG1vZF9nZW5lcmF0b3IgaW5zdGFuY2VvZiBNb2RHZW5lcmF0b3IpKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibW9kX2dlbmVyYXRvciBuZWVkcyB0byBiZSBvZiB0eXBlIE1vZEdlbmVyYXRvclwiKTtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKCEoYmFzZWl0ZW0gaW5zdGFuY2VvZiBJdGVtKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImJhc2VpdGVtIG5lZWRzIHRvIGJlIG9mIHR5cGUgQmFzZUl0ZW1cIik7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZmlsdGVyXHJcbiAgICAgICAgdmFyIHdoaXRlbGlzdCA9IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkxPV0VSX0lMVkxcclxuICAgICAgICAgICAgICAgICAgICAgICAgfCBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5ET01BSU5fRlVMTFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkFMUkVBRFlfUFJFU0VOVFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8IE1hc3Rlck1vZC5BUFBMSUNBQkxFX0JZVEUuTk9fTVVMVElNT0RcclxuICAgICAgICAgICAgICAgICAgICAgICAgfCBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5BQk9WRV9MTERfTEVWRUw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGFwcGxpY2FibGVfbW9kcyA9IG1vZF9nZW5lcmF0b3IubW9kcyhiYXNlaXRlbSwgd2hpdGVsaXN0KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBtb2QgZ3JvdXBzXHJcbiAgICAgICAgdmFyIHByZWZpeGVzID0gU3Bhd25hYmxlLmNhbGN1bGF0ZVNwYXduY2hhbmNlKCQuZ3JlcChhcHBsaWNhYmxlX21vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1vZC5pc1ByZWZpeCgpO1xyXG4gICAgICAgIH0pLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2QuYXBwbGljYWJsZUNhY2hlZCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBzdWZmaXhlcyA9IFNwYXduYWJsZS5jYWxjdWxhdGVTcGF3bmNoYW5jZSgkLmdyZXAoYXBwbGljYWJsZV9tb2RzLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2QuaXNTdWZmaXgoKTtcclxuICAgICAgICB9KSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbW9kLmFwcGxpY2FibGVDYWNoZWQoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaW1wbGljaXRzID0gU3Bhd25hYmxlLmNhbGN1bGF0ZVNwYXduY2hhbmNlKCQuZ3JlcChhcHBsaWNhYmxlX21vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1vZC5pbXBsaWNpdENhbmRpZGF0ZSgpO1xyXG4gICAgICAgIH0pLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2QuYXBwbGljYWJsZUNhY2hlZCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJpbXBsaWNpdHNcIiwgaW1wbGljaXRzKTtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKFwicHJlZml4ZXNcIiwgcHJlZml4ZXMpO1xyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJzdWZmaXhcIiwgc3VmZml4ZXMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGRpc3BsYXkgcHJlZml4ZXNcclxuICAgICAgICBkaXNwbGF5X21vZF9ncm91cChwcmVmaXhlcywgJChcIiNwcmVmaXhlc1wiKSwgdHJ1ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZGlzcGxheSBzdWZmaXhlc1xyXG4gICAgICAgIGRpc3BsYXlfbW9kX2dyb3VwKHN1ZmZpeGVzLCAkKFwiI3N1ZmZpeGVzXCIpLCB0cnVlKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBkaXNwbGF5IGltcGxpY2l0cyBcclxuICAgICAgICBkaXNwbGF5X21vZF9ncm91cChpbXBsaWNpdHMsICQoXCIjaW1wbGljaXRzXCIpLCBmYWxzZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gcmVtb3ZlIG5vdF9yb2xsYWJsZSBjbGFzcyBpZiByb2xsYWJsZVxyXG4gICAgICAgICQuZWFjaChwcmVmaXhlcy5jb25jYXQoc3VmZml4ZXMpLCBmdW5jdGlvbiAoaSwgbW9kKSB7XHJcbiAgICAgICAgICAgIGlmIChtb2Qucm9sbGFibGVDYWNoZWQoKSkge1xyXG4gICAgICAgICAgICAgICAgJChcIiNjb3JyZWN0LWdyb3VwLVwiICsgbW9kLmdldFByb3AoXCJDb3JyZWN0R3JvdXBcIikpLnJlbW92ZUNsYXNzKFwibm90X3JvbGxhYmxlXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gcmVzdG9yZSB0b2dnbGUgZ3JvdXBzXHJcbiAgICAgICAgJGNsaWNrZWRfZ3JvdXBzLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKFwiI1wiICsgJCh0aGlzKS5hdHRyKFwiaWRcIikpLnRyaWdnZXIoXCJjbGlja1wiKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyB3YXMgZXhwYW5kZWQ/XHJcbiAgICAgICAgaWYgKHdhc19leHBhbmRlZCkge1xyXG4gICAgICAgICAgICAkKFwiI2V4cGFuZF9tb2RzXCIpLnRyaWdnZXIoXCJjbGlja1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtBcnJheVtNb2RdfSBtb2RzXHJcbiAgICAgKiBAcGFyYW0ge2pRdWVyeX0gJHRhYmxlIHZpc3VhbCBjb250YWluZXJcclxuICAgICAqIEBwYXJhbSB7Qm9vbGVhbn0gZ3JvdXBpbmcgd2V0aGVyIHRvIGdyb3VwIG1vZHMgb2YgYSBncm91cCBpbnRvIHRib2RpZXNcclxuICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICovXHJcbiAgICB2YXIgZGlzcGxheV9tb2RfZ3JvdXAgPSBmdW5jdGlvbiAobW9kcywgJHRhYmxlLCBncm91cGluZykge1xyXG4gICAgICAgIC8vIGVtcHR5IG1vZHNcclxuICAgICAgICBpZiAoZ3JvdXBpbmcpIHtcclxuICAgICAgICAgICAgJChcInRib2R5Om5vdCgudGVtcGxhdGUpXCIsICR0YWJsZSkucmVtb3ZlKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgJChcIi5tb2Q6bm90KC50ZW1wbGF0ZSlcIiwgJHRhYmxlKS5yZW1vdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdmFyICRtb2RfdGVtcGxhdGUgPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcIi5tb2RcIiwgJHRhYmxlKTtcclxuXHJcbiAgICAgICAgLy8gZGlzcGxheSBhZmZpeGVzXHJcbiAgICAgICAgJChcImNhcHRpb24gLmNvdW50XCIsICR0YWJsZSkudGV4dChtb2RzLmxlbmd0aCk7XHJcbiAgICAgICAgJC5lYWNoKG1vZHMsIGZ1bmN0aW9uIChfLCBtb2QpIHtcclxuICAgICAgICAgICAgdmFyICRtb2QgPSAkbW9kX3RlbXBsYXRlLmNsb25lKHRydWUpO1xyXG4gICAgICAgICAgICB2YXIgc2VyaWFsaXplZCA9IG1vZC5zZXJpYWxpemUoKTtcclxuICAgICAgICAgICAgdmFyIHRpdGxlLCBjb3JyZWN0X2dyb3VwLCAkY29ycmVjdF9ncm91cDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICRtb2QuYXR0cihcImlkXCIsIG1vZC5kb21JZCgpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGdyb3VwaW5nXHJcbiAgICAgICAgICAgIGlmIChncm91cGluZykge1xyXG4gICAgICAgICAgICAgICAgY29ycmVjdF9ncm91cCA9IG1vZC5nZXRQcm9wKFwiQ29ycmVjdEdyb3VwXCIpO1xyXG4gICAgICAgICAgICAgICAgJGNvcnJlY3RfZ3JvdXAgPSAkKFwidGJvZHkubW9kc1tkYXRhLWNvcnJlY3QtZ3JvdXA9J1wiICsgY29ycmVjdF9ncm91cCArIFwiJ11cIiwgJHRhYmxlKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gbmV3IGdyb3VwP1xyXG4gICAgICAgICAgICAgICAgaWYgKCEkY29ycmVjdF9ncm91cC5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgJGNvcnJlY3RfZ3JvdXBfaGVhZGVyID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCJ0Ym9keS5jb3JyZWN0X2dyb3VwXCIsICR0YWJsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgJGNvcnJlY3RfZ3JvdXAgPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcInRib2R5Lm1vZHNcIiwgJHRhYmxlKS5oaWRlKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIG1heWJlIGNoYW5nZSBkbyBkYXRhKCkgYW5kIGZpbHRlcigpXHJcbiAgICAgICAgICAgICAgICAgICAgJGNvcnJlY3RfZ3JvdXBfaGVhZGVyLmF0dHIoXCJpZFwiLCBcImNvcnJlY3QtZ3JvdXAtXCIgKyBjb3JyZWN0X2dyb3VwKTtcclxuICAgICAgICAgICAgICAgICAgICAkY29ycmVjdF9ncm91cC5hdHRyKFwiZGF0YS1jb3JyZWN0LWdyb3VwXCIsIGNvcnJlY3RfZ3JvdXApO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAkKFwidGguY29ycmVjdF9ncm91cFwiLCAkY29ycmVjdF9ncm91cF9oZWFkZXIpLnRleHQobW9kLmNvcnJlY3RHcm91cFRyYW5zbGF0ZWQoKS5yZXBsYWNlKC9cXG4vLCBcIiAvIFwiKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICR0YWJsZS5hcHBlbmQoJGNvcnJlY3RfZ3JvdXBfaGVhZGVyLCAkY29ycmVjdF9ncm91cCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAkY29ycmVjdF9ncm91cCA9ICQoXCJ0Ym9keVwiLCAkdGFibGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBlcnJvclxyXG4gICAgICAgICAgICB2YXIgYXBwbGljYWJsZV9ieXRlX2h1bWFuID0gbW9kLmFwcGxpY2FibGVCeXRlSHVtYW4oKTtcclxuICAgICAgICAgICAgJG1vZC5hdHRyKFwiZGF0YS1hcHBsaWNhYmxlX2J5dGVcIiwgYXBwbGljYWJsZV9ieXRlX2h1bWFuLmJpdHMuam9pbihcIi1cIikpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHNwYXduYWJsZV9ieXRlX2h1bWFuID0ge1xyXG4gICAgICAgICAgICAgICAgc3RyaW5nczogW11cclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgaWYgKFNwYXduYWJsZS5pbXBsZW1lbnRlZEJ5KG1vZCkpIHtcclxuICAgICAgICAgICAgICAgIHNwYXduYWJsZV9ieXRlX2h1bWFuID0gbW9kLnNwYXduYWJsZUJ5dGVIdW1hbigpO1xyXG4gICAgICAgICAgICAgICAgJG1vZC5hdHRyKFwiZGF0YS1zcGF3bmFibGUtYnl0ZVwiLCBzcGF3bmFibGVfYnl0ZV9odW1hbi5iaXRzLmpvaW4oXCItXCIpKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gY2hhbmNlXHJcbiAgICAgICAgICAgICAgICAkKFwiLnNwYXduX2NoYW5jZVwiLCAkbW9kKS50ZXh0KG1vZC5odW1hblNwYXduY2hhbmNlKCkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aXRsZSA9IGFwcGxpY2FibGVfYnl0ZV9odW1hbi5zdHJpbmdzLmNvbmNhdChzcGF3bmFibGVfYnl0ZV9odW1hbi5zdHJpbmdzKS5qb2luKFwiYCBhbmQgYFwiKTtcclxuICAgICAgICAgICAgaWYgKHRpdGxlKSB7XHJcbiAgICAgICAgICAgICAgICAkbW9kLnByb3AoXCJ0aXRsZVwiLCBcImBcIiArIHRpdGxlICsgXCJgXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBpbHZsXHJcbiAgICAgICAgICAgICQoXCIuaWx2bFwiLCAkbW9kKS50ZXh0KG1vZC5nZXRQcm9wKFwiTGV2ZWxcIikpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gbmFtZVxyXG4gICAgICAgICAgICAkKFwiLm5hbWVcIiwgJG1vZCkudGV4dChtb2QubmFtZSgpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHZhbHVlXHJcbiAgICAgICAgICAgICQoXCIuc3RhdHNcIiwgJG1vZCkudGV4dChtb2QudCgpKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHNlcmlhbGl6ZVxyXG4gICAgICAgICAgICAkbW9kLmRhdGEoXCJtb2RcIiwgc2VyaWFsaXplZCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBwb3NzaWJsZT8gVE9ETyBiZXR0ZXIgd2F5PyBtYXliZSBzY2FuIGJ5dGVcclxuICAgICAgICAgICAgaWYgKHRpdGxlKSB7XHJcbiAgICAgICAgICAgICAgICAkKFwiLmFkZF9tb2RcIiwgJG1vZCkucmVtb3ZlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHZpc3VhbFxyXG4gICAgICAgICAgICAkbW9kLmFkZENsYXNzKHNlcmlhbGl6ZWQua2xhc3MpO1xyXG4gICAgICAgICAgICAkbW9kLmFkZENsYXNzKG1vZC5tb2RUeXBlKCkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJGNvcnJlY3RfZ3JvdXAuYXBwZW5kKCRtb2QpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGxldCB0aGUgcGx1Z2luIGtub3cgdGhhdCB3ZSBtYWRlIGEgdXBkYXRlIFxyXG4gICAgICAgICR0YWJsZS50cmlnZ2VyKFwidXBkYXRlXCIpOyBcclxuICAgICAgICAvLyBzb3J0IG9uIGlsdmwgZGVzY1xyXG4gICAgICAgICR0YWJsZS50cmlnZ2VyKFwic29ydG9uXCIsW1tbMCwxXV1dKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHZhciBkaXNwbGF5X21vZF9nZW5fYXBwbGljYWJpbGl0eSA9IGZ1bmN0aW9uIChiYXNlaXRlbSwgYWxsX21vZHMpIHtcclxuICAgICAgICBpZiAoIShiYXNlaXRlbSBpbnN0YW5jZW9mIEl0ZW0pKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgJChcInVsLmN1cnJlbmNpZXMgLmFwcGxpY2FibGUgaW5wdXQuTW9kR2VuZXJhdG9yOnJhZGlvXCIpLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgJHRoaXMgPSAkKHRoaXMpO1xyXG4gICAgICAgICAgICB2YXIgJGFwcGxpY2FibGUgPSAkdGhpcy5wYXJlbnRzKFwiLmFwcGxpY2FibGVcIik7XHJcbiAgICAgICAgICAgIHZhciBtb2RfZ2VuZXJhdG9yID0gTW9kR2VuZXJhdG9yRmFjdG9yeS5idWlsZCgkdGhpcy52YWwoKSwgYWxsX21vZHMpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJHRoaXMucHJvcChcImRpc2FibGVkXCIsICFtb2RfZ2VuZXJhdG9yLmFwcGxpY2FibGVUbyhiYXNlaXRlbSkpO1xyXG4gICAgICAgICAgICB2YXIgYXBwbGljYWJsZV9ieXRlID0gbW9kX2dlbmVyYXRvci5hcHBsaWNhYmxlQnl0ZUh1bWFuKCk7XHJcblxyXG4gICAgICAgICAgICAkYXBwbGljYWJsZS5hdHRyKFwidGl0bGVcIiwgYXBwbGljYWJsZV9ieXRlLnN0cmluZ3Muam9pbihcIiBhbmQgXCIpKTtcclxuICAgICAgICAgICAgJGFwcGxpY2FibGUuYXR0cihcImRhdGEtYXBwbGljYWJsZV9ieXRlXCIsIGFwcGxpY2FibGVfYnl0ZS5iaXRzLmpvaW4oXCItXCIpKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAvLyBsb2FkIGRhdGFcclxuICAgICQud2hlbihcclxuICAgICAgICBuZXcgRGF0YURlcGVuZGVuY3koXCJqcy9kYXRhL21vZHMuanNvblwiLCBcIiNkYXRhX2xvYWRlcl9tb2RzXCIpLmdldEpTT04oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgbW9kcyA9IGpzb247XHJcbiAgICAgICAgICAgIE1vZC5tb2RzID0gbW9kcztcclxuICAgICAgICB9KSxcclxuICAgICAgICBuZXcgRGF0YURlcGVuZGVuY3koXCJqcy9kYXRhL3RhZ3MuanNvblwiLCBcIiNkYXRhX2xvYWRlcl90YWdzXCIpLmdldEpTT04oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgdGFncyA9IGpzb247XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkKHRhZ3MpLmVhY2goZnVuY3Rpb24gKF8sIHRhZykge1xyXG4gICAgICAgICAgICAgICAgVEFHU1t0YWcuSWQudG9VcHBlckNhc2UoKV0gPSArdGFnLlJvd3M7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG5ldyBEYXRhRGVwZW5kZW5jeShcImpzL2RhdGEvYmFzZWl0ZW10eXBlcy5qc29uXCIsIFwiI2RhdGFfbG9hZGVyX2Jhc2VpdGVtdHlwZXNcIikuZ2V0SlNPTihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICBiYXNlaXRlbXR5cGVzID0ganNvbjtcclxuICAgICAgICB9KSxcclxuICAgICAgICBuZXcgRGF0YURlcGVuZGVuY3koXCJqcy9kYXRhL3N0YXRzLmpzb25cIiwgXCIjZGF0YV9sb2FkZXJfc3RhdHNcIikuZ2V0SlNPTihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICBzdGF0cyA9IGpzb247XHJcbiAgICAgICAgICAgIE1vZC5hbGxfc3RhdHMgPSBzdGF0cztcclxuICAgICAgICB9KSxcclxuICAgICAgICBuZXcgRGF0YURlcGVuZGVuY3koXCJqcy9kYXRhL3RyYW5zbGF0aW9ucy9FbmdsaXNoL3N0YXRfZGVzY3JpcHRpb25zLmpzb25cIiwgXCIjZGF0YV9sb2FkZXJfc3RhdF9kZXNjXCIpLmdldEpTT04oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgTW9kLmxvY2FsaXphdGlvbiA9IG5ldyBMb2NhbGl6YXRpb24oanNvbik7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbmV3IERhdGFEZXBlbmRlbmN5KFwianMvZGF0YS9tZXRhX2RhdGEuanNvblwiLCBcIiNkYXRhX2xvYWRlcl9tZXRhX2RhdGFcIikuZ2V0SlNPTihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICBJdGVtLm1ldGFfZGF0YSA9IGpzb247XHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbmV3IERhdGFEZXBlbmRlbmN5KFwianMvZGF0YS9jcmFmdGluZ2JlbmNob3B0aW9ucy5qc29uXCIsIFwiI2RhdGFfbG9hZGVyX2NyYWZ0aW5nYmVuY2hvcHRpb25zXCIpLmdldEpTT04oZnVuY3Rpb24gKGpzb24pIHtcclxuICAgICAgICAgICAgTWFzdGVyTW9kLmNyYWZ0aW5nYmVuY2hvcHRpb25zID0ganNvbjtcclxuICAgICAgICB9KSxcclxuICAgICAgICBuZXcgRGF0YURlcGVuZGVuY3koXCJqcy9kYXRhL3RyYW5zbGF0aW9ucy9FbmdsaXNoL21vZF9jb3JyZWN0X2dyb3Vwcy5qc29uXCIsIFwiI2RhdGFfbG9hZGVyX21vZF9jb3JyZWN0X2dyb3Vwc19sb2NcIikuZ2V0SlNPTihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICBNb2QuY29ycmVjdF9ncm91cF9sb2NhbGl6YXRpb24gPSBqc29uO1xyXG4gICAgICAgIH0pXHJcbiAgICApLnRoZW4oZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwibG9hZGVkIFwiICsgbW9kcy5sZW5ndGggKyBcIiBtb2RzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsb2FkZWQgXCIgKyB0YWdzLmxlbmd0aCArIFwiIHRhZ3NcIixcclxuICAgICAgICAgICAgICAgICAgICBcImxvYWRlZCBcIiArIGJhc2VpdGVtdHlwZXMubGVuZ3RoICsgXCIgYmFzZWl0ZW10eXBlc1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibG9hZGVkIFwiICsgc3RhdHMubGVuZ3RoICsgXCIgc3RhdHNcIik7IFxyXG5cclxuICAgICAgICAvLyBwZXJzaXN0ZW5jZSB2YXJzXHJcbiAgICAgICAgdmFyIG1vZF9nZW5lcmF0b3IgPSBudWxsO1xyXG4gICAgICAgIHZhciBiYXNlaXRlbSA9IG51bGw7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gaXRlbSBzY3JvbGxzIGZpeGVkXHJcbiAgICAgICAgdmFyIGl0ZW1fZml4ZWRfdG9wO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBnZXRfc2VsZWN0ZWRfbW9kX2dlbmVyYXRvciA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyICRtb2RfZ2VuZXJhdG9yID0gJChcImlucHV0Lk1vZEdlbmVyYXRvcjpyYWRpbzpjaGVja2VkXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCRtb2RfZ2VuZXJhdG9yLmhhc0NsYXNzKFwiTWFzdGVyYmVuY2hcIikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTWFzdGVyYmVuY2gobW9kcywgKyRtb2RfZ2VuZXJhdG9yLmRhdGEoJ25wY19tYXN0ZXJfa2V5JykpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1vZEdlbmVyYXRvckZhY3RvcnkuYnVpbGQoJChcImlucHV0Lk1vZEdlbmVyYXRvcjpyYWRpbzpjaGVja2VkXCIpLnZhbCgpLCBtb2RzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZ2V0IGxvY2FsaXphdGlvbiBmb3IgYnl0ZXNldFxyXG4gICAgICAgIEJ5dGVTZXQuaW5pdExvY2FsaXphdGlvbigkKFwiI2xlZ2VuZHNcIikpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBnZXRfc2VsZWN0ZWRfYmFzZWl0ZW0gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciBiYXNlaXRlbV9rZXkgPSAkKFwiI2Jhc2VpdGVtcyBvcHRpb246c2VsZWN0ZWRcIikuZGF0YShcImJhc2VpdGVtX3ByaW1hcnlcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW1fa2V5ID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBiYXNlaXRlbV9wcm9wcyA9IGJhc2VpdGVtdHlwZXNbYmFzZWl0ZW1fa2V5XTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChiYXNlaXRlbV9wcm9wcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiY291bGQgbm90IGZpbmRcIiwgYmFzZWl0ZW1fa2V5KTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgYmFzZWl0ZW0gPSBuZXcgSXRlbShiYXNlaXRlbV9wcm9wcyk7XHJcbiAgICAgICAgICAgIHZhciAkaWx2bCA9ICQoXCIjdXNlZF9iYXNlaXRlbSBpbnB1dC5pbHZsOm5vdCgudGVtcGxhdGUpXCIpO1xyXG4gICAgICAgICAgICBpZiAoJGlsdmwubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICBiYXNlaXRlbS5pdGVtX2xldmVsID0gKyRpbHZsLnZhbCgpO1xyXG4gICAgICAgICAgICB9IFxyXG4gICAgICAgICAgICByZXR1cm4gYmFzZWl0ZW07XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBkaXNwbGF5IGl0ZW1fY2xhc3Nlc1xyXG4gICAgICAgICQuZWFjaChJdGVtLklURU1DTEFTU0VTLCBmdW5jdGlvbiAoaWRlbnQsIGl0ZW1fY2xhc3MpIHtcclxuICAgICAgICAgICAgdmFyICRvcHRpb24gPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcIiNpdGVtX2NsYXNzZXMgb3B0aW9uXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJG9wdGlvbi5hZGRDbGFzcyhpZGVudCk7XHJcbiAgICAgICAgICAgICRvcHRpb24udGV4dChpZGVudCk7XHJcbiAgICAgICAgICAgICRvcHRpb24uZGF0YShcImlkZW50XCIsIGlkZW50KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICRvcHRpb24uYXBwZW5kVG8oXCIjaXRlbV9jbGFzc2VzXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGNoYW5nZSBpdGVtX2NsYXNzIGhhbmRsZVxyXG4gICAgICAgICQoXCIjaXRlbV9jbGFzc2VzXCIpLm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyICRzZWxlY3RlZCA9ICQoXCJvcHRpb246c2VsZWN0ZWRcIiwgdGhpcyk7XHJcbiAgICAgICAgICAgIHZhciBzdWJfdGFnID0gJChcIiNpdGVtX2NsYXNzX3N1Yl90YWdcIikudmFsKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBzZWxlY3RlZCBJdGVtQ2xhc3NcclxuICAgICAgICAgICAgdmFyIGl0ZW1fY2xhc3MgPSBJdGVtLklURU1DTEFTU0VTWyRzZWxlY3RlZC5kYXRhKFwiaWRlbnRcIildO1xyXG4gICAgICAgICAgICBpZiAoaXRlbV9jbGFzcyA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBiYXNlaXRlbXMgdGhhdCBoYXZlIHRoaXMgSXRlbUNsYXNzXHJcbiAgICAgICAgICAgIC8vIG5lZWRzIG1hcCBpbnN0ZWFkIG9mIGdyZXAgYmVjYXVzZSB0YWJsZSBzdHJ1Y3R1cmUgcHJpbWFyeSA9PiB0YWJsZSBjb2xzXHJcbiAgICAgICAgICAgIHZhciBiYXNlaXRlbXMgPSAkLm1hcChiYXNlaXRlbXR5cGVzLCBmdW5jdGlvbiAoYmFzZWl0ZW10eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaXRlbV9jbGFzcy5QUklNQVJZID09PSArYmFzZWl0ZW10eXBlLkl0ZW1DbGFzcyBcclxuICAgICAgICAgICAgICAgICAgICAgICAgJiYgKCFzdWJfdGFnIHx8IGJhc2VpdGVtdHlwZS5UYWdzS2V5cy5zcGxpdChcIixcIikuaW5kZXhPZihzdWJfdGFnKSAhPT0gLTEpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJhc2VpdGVtdHlwZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGVtcHR5IGJhc2VpdGVtc1xyXG4gICAgICAgICAgICAkKFwiI2Jhc2VpdGVtcyBvcHRpb246bm90KC50ZW1wbGF0ZSlcIikucmVtb3ZlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBkaXNwbGF5IGJhc2VpdGVtc1xyXG4gICAgICAgICAgICAkLmVhY2goYmFzZWl0ZW1zLCBmdW5jdGlvbiAoXywgYmFzZWl0ZW1fcHJvcHMpIHtcclxuICAgICAgICAgICAgICAgIHZhciAkb3B0aW9uID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCIjYmFzZWl0ZW1zIG9wdGlvblwiKTtcclxuICAgICAgICAgICAgICAgICRvcHRpb24udGV4dChiYXNlaXRlbV9wcm9wcy5OYW1lKTtcclxuICAgICAgICAgICAgICAgICRvcHRpb24uYXR0cihcImRhdGEtYmFzZWl0ZW1fcHJpbWFyeVwiLCBiYXNlaXRlbV9wcm9wcy5wcmltYXJ5KTtcclxuICAgICAgICAgICAgICAgICRvcHRpb24uYXR0cihcImRhdGEtbmFtZVwiLCBiYXNlaXRlbV9wcm9wcy5OYW1lKTtcclxuICAgICAgICAgICAgICAgICRvcHRpb24uYXBwZW5kVG8oXCIjYmFzZWl0ZW1zXCIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHNlbGVjdCBmaXJzdCBiYXNlaXRlbVxyXG4gICAgICAgICAgICAkKFwiI2Jhc2VpdGVtcyBvcHRpb246bm90KC50ZW1wbGF0ZSk6Zmlyc3RcIikucHJvcChcInNlbGVjdGVkXCIsIHRydWUpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gYW5kIHRyaWdnZXIgb25jaGFuZ2VcclxuICAgICAgICAgICAgJChcIiNiYXNlaXRlbXNcIikudHJpZ2dlcihcImNoYW5nZVwiKTtcclxuICAgICAgICB9KTsgXHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gY2hhbmdlIGJhc2VpdGVtIGhhbmRsZVxyXG4gICAgICAgICQoXCIjYmFzZWl0ZW1zXCIpLm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgLy8gcGVyc2lzdGVuY2VcclxuICAgICAgICAgICAgYmFzZWl0ZW0gPSBnZXRfc2VsZWN0ZWRfYmFzZWl0ZW0oKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHVwZGF0ZSBndWlcclxuICAgICAgICAgICAgZGlzcGxheV9iYXNlaXRlbShiYXNlaXRlbSwgXCIjdXNlZF9iYXNlaXRlbVwiKTtcclxuICAgICAgICAgICAgZGlzcGxheV9hdmFpbGFibGVfbW9kcyhtb2RfZ2VuZXJhdG9yLCBiYXNlaXRlbSk7ICBcclxuICAgICAgICAgICAgZGlzcGxheV9tb2RfZ2VuX2FwcGxpY2FiaWxpdHkoYmFzZWl0ZW0sIG1vZHMpO1xyXG4gICAgICAgIH0pOyBcclxuICAgICAgICBcclxuICAgICAgICB2YXIgaGFzaGJhbmcgPSBuZXcgSGFzaGJhbmcoKTtcclxuICAgICAgICB2YXIgaGFzaGJhbmdfY2hhbmdlID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgbmV4dF9maWxlO1xyXG4gICAgICAgICAgICB2YXIgbWFwcGluZ3MgPSB7XHJcbiAgICAgICAgICAgICAgICByaW5nczogJ1JJTkcnLFxyXG4gICAgICAgICAgICAgICAgYW11bGV0czogJ0FNVUxFVCcsXHJcbiAgICAgICAgICAgICAgICBiZWx0czogJ0JFTFQnLFxyXG4gICAgICAgICAgICAgICAgamV3ZWxzOiAnSkVXRUwnLFxyXG4gICAgICAgICAgICAgICAgY2xhd3M6ICdDTEFXJyxcclxuICAgICAgICAgICAgICAgIGRhZ2dlcnM6ICdEQUdHRVInLFxyXG4gICAgICAgICAgICAgICAgYm93czogJ0JPVycsXHJcbiAgICAgICAgICAgICAgICBxdWl2ZXJzOiAnUVVJVkVSJyxcclxuICAgICAgICAgICAgICAgIHN0YXZlczogJ1NUQUZGJyxcclxuICAgICAgICAgICAgICAgIHNjZXB0cmVzOiAnU0NFUFRSRScsXHJcbiAgICAgICAgICAgICAgICB3YW5kczogJ1dBTkQnLFxyXG4gICAgICAgICAgICAgICAgJzFoX2F4ZXMnOiAnQVhFXzFIJyxcclxuICAgICAgICAgICAgICAgICcyaF9heGVzJzogJ0FYRV8ySCcsXHJcbiAgICAgICAgICAgICAgICAnMWhfbWFjZXMnOiAnTUFDRV8xSCcsXHJcbiAgICAgICAgICAgICAgICAnMmhfbWFjZXMnOiAnTUFDRV8ySCcsXHJcbiAgICAgICAgICAgICAgICAnMWhfc3dvcmRzJzogJ1NXT1JEXzFIJyxcclxuICAgICAgICAgICAgICAgICcyaF9zd29yZHMnOiAnU1dPUkRfMkgnLFxyXG4gICAgICAgICAgICAgICAgJ21hcHMnOiAnTUFQJyxcclxuICAgICAgICAgICAgICAgIGFybW91cnM6ICdBUk1PVVInLFxyXG4gICAgICAgICAgICAgICAgZ2xvdmVzOiAnR0xPVkVTJyxcclxuICAgICAgICAgICAgICAgIGJvb3RzOiAnQk9PVFMnLFxyXG4gICAgICAgICAgICAgICAgaGVsbWV0czogJ0hFTE1FVCcsXHJcbiAgICAgICAgICAgICAgICBzaGllbGRzOiAnU0hJRUxEJ1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB2YXIgJGJhc2VpdGVtO1xyXG4gICAgICAgICAgICB2YXIgc3ViX3RhZyA9ICcnO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gaXRlbWNsYXNzXHJcbiAgICAgICAgICAgIG5leHRfZmlsZSA9IHRoaXMuZ2V0UGF0aCgpLm5leHRGaWxlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAobWFwcGluZ3NbbmV4dF9maWxlXSkge1xyXG4gICAgICAgICAgICAgICAgJCgnI2l0ZW1fY2xhc3NlcyAuaXRlbV9jbGFzcy4nICsgbWFwcGluZ3NbbmV4dF9maWxlXSkucHJvcChcInNlbGVjdGVkXCIsIHRydWUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgJCgnI2l0ZW1fY2xhc3NlcyAuaXRlbV9jbGFzcy5SSU5HJykucHJvcChcInNlbGVjdGVkXCIsIHRydWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoW1wiYXJtb3Vyc1wiLCBcImJvb3RzXCIsIFwiZ2xvdmVzXCIsIFwiaGVsbWV0c1wiLCBcInNoaWVsZHNcIl0uaW5kZXhPZihuZXh0X2ZpbGUpICE9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgLy8gc2V0IGxpbmtzIHRvIGl0ZW1fY2xhc3NcclxuICAgICAgICAgICAgICAgICQoXCIjdGFnX3NlbGVjdG9yX3JlcSBhXCIpLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciAkdGhpcyA9ICQodGhpcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgJHRoaXMuYXR0cihcImhyZWZcIiwgXCIjIS9cIiArIG5leHRfZmlsZSArIFwiL1wiICsgJHRoaXMuYXR0cihcImRhdGEtc3ViX3RhZ1wiKSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJChcIiN0YWdfc2VsZWN0b3JfcmVxXCIpLnNob3coKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmIChuZXh0X2ZpbGUgPT09ICdtYXBzJykge1xyXG4gICAgICAgICAgICAgICAgJChcIiN0YWdfc2VsZWN0b3JfbWFwXCIpLnNob3coKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICQoXCIuc3ViX3RhZ19zZWxlY3RvclwiKS5oaWRlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHN1YiBncm91cCBvZiBpdGVtY2xhc3M/IHN0cl9hcm1vdXIsIGRleF9hcm1vdXIgZXRjXHJcbiAgICAgICAgICAgIG5leHRfZmlsZSA9IHRoaXMuZ2V0UGF0aCgpLm5leHRGaWxlKCk7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgbmV4dF9maWxlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgLy8gc2VsZWN0ICogZnJvbSB0YWdzIHdoZXJlIElkID0gbmV4dF9maWxlXHJcbiAgICAgICAgICAgICAgICBzdWJfdGFnID0gJC5tYXAodGFncywgZnVuY3Rpb24gKHRhZykge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0YWcuSWQgPT09IG5leHRfZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGFnO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBzdWJfdGFnIGZvdW5kXHJcbiAgICAgICAgICAgICAgICBpZiAoc3ViX3RhZyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3ViX3RhZyA9IHN1Yl90YWcucHJpbWFyeTtcclxuICAgICAgICAgICAgICAgICAgICAkKFwiLnN1Yl90YWdfc2VsZWN0b3JcIikuaGlkZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIG5leHQgZGlyZWN0b3J5XHJcbiAgICAgICAgICAgICAgICAgICAgbmV4dF9maWxlID0gdGhpcy5nZXRQYXRoKCkubmV4dEZpbGUoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAkKFwiI2l0ZW1fY2xhc3Nfc3ViX3RhZ1wiKS52YWwoc3ViX3RhZyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBubyB0cmlnZ2VyIGl0ZW1jbGFzcyBjaGFuZ2VcclxuICAgICAgICAgICAgJCgnI2l0ZW1fY2xhc3NlcycpLnRyaWdnZXIoXCJjaGFuZ2VcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBiYXNlaXRlbVxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIG5leHRfZmlsZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgICRiYXNlaXRlbSA9ICQoXCIjYmFzZWl0ZW1zIG9wdGlvbjpub3QoLnRlbXBsYXRlKVtkYXRhLW5hbWU9J1wiICsgbmV4dF9maWxlLnJlcGxhY2UoL18vLCBcIiBcIikgKyBcIiddXCIpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCRiYXNlaXRlbS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAkYmFzZWl0ZW0ucHJvcChcInNlbGVjdGVkXCIsIHRydWUpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBuZXh0X2ZpbGUgPSB0aGlzLmdldFBhdGgoKS5uZXh0RmlsZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBUT0RPIGNhdGNoIG5vdCBmb3VuZFxyXG4gICAgICAgICAgICAvLyBIYXNoYmFuZyBiYXNpYyBndWkgbmF2aWdhdGlvblxyXG4gICAgICAgICAgICBpZiAobmV4dF9maWxlID09PSAnd2l0aFJlY2lwZScpIHtcclxuICAgICAgICAgICAgICAgIG5leHRfZmlsZSA9IHRoaXMuZ2V0UGF0aCgpLm5leHRGaWxlKCk7XHJcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKG5leHRfZmlsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ25vX2F0dGFja19tb2RzJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbm9fY2FzdGVyX21vZHMnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdub19hdHRhY2tfb3JfY2FzdGVyX21vZHMnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdsbGRfbW9kcyc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBOb3RGb3VuZEV4Y2VwdGlvbigncmVjaXBlIGAnICsgbmV4dF9maWxlICsgJ2Agbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8vIFRPRE8gZG9lc250IHdvcmtcclxuICAgICAgICBoYXNoYmFuZy5vbkNoYW5nZShoYXNoYmFuZ19jaGFuZ2UpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGhhc2hiYW5nLndpdGhXaW5kb3cod2luZG93KTtcclxuICAgICAgICBoYXNoYmFuZ19jaGFuZ2UuYXBwbHkoaGFzaGJhbmcpO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQod2luZG93KS5vbihcImhhc2hjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBoYXNoYmFuZy53aXRoV2luZG93KHdpbmRvdyk7XHJcbiAgICAgICAgICAgIGhhc2hiYW5nX2NoYW5nZS5hcHBseShoYXNoYmFuZyk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIGNoYW5nZSBtb2RnZW4gaGFuZGxlXHJcbiAgICAgICAgJChcImlucHV0Lk1vZEdlbmVyYXRvcjpyYWRpb1wiKS5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIC8vIHBlcnNpc3RlbmNlXHJcbiAgICAgICAgICAgIG1vZF9nZW5lcmF0b3IgPSBnZXRfc2VsZWN0ZWRfbW9kX2dlbmVyYXRvcigpO1xyXG5cclxuICAgICAgICAgICAgLy8gdXBkYXRlIGd1aVxyXG4gICAgICAgICAgICBkaXNwbGF5X2F2YWlsYWJsZV9tb2RzKG1vZF9nZW5lcmF0b3IsIGJhc2VpdGVtKTtcclxuICAgICAgICAgICAgJChcIiN1c2VfbW9kX2dlbiAubmFtZVwiKS50ZXh0KG1vZF9nZW5lcmF0b3IubmFtZSgpKTtcclxuICAgICAgICAgICAgJChcIiN1c2VfbW9kX2dlbiAuY3JhZnRpbmdiZW5jaG9wdGlvblwiKS5lbXB0eSgpO1xyXG4gICAgICAgICAgICAkKFwiI3VzZV9tb2RfZ2VuXCIpLmF0dHIoXCJkYXRhLWFwcGxpY2FibGVcIiwgXCJcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZW1vdmUgY3JhZnRpbmdiZW5jaG9wdGlvbnNcclxuICAgICAgICAgICAgdmFyICRjcmFmdGluZ2JlbmNob3B0aW9ucyA9ICQoXCIjY3JhZnRpbmdiZW5jaG9wdGlvbnNcIik7XHJcbiAgICAgICAgICAgICQoXCIuY3JhZnRpbmdiZW5jaG9wdGlvbjpub3QoLnRlbXBsYXRlKVwiLCAkY3JhZnRpbmdiZW5jaG9wdGlvbnMpLnJlbW92ZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG1vZF9nZW5lcmF0b3IgaW5zdGFuY2VvZiBNYXN0ZXJiZW5jaCkge1xyXG4gICAgICAgICAgICAgICAgLy8gZGlzcGxheSBvcHRpb25zXHJcbiAgICAgICAgICAgICAgICAkLmVhY2gobW9kX2dlbmVyYXRvci5jcmFmdGluZ2JlbmNob3B0aW9ucywgZnVuY3Rpb24gKGksIGNyYWZ0aW5nYmVuY2hvcHRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBNb2QgYXRsZWFzdCBkaXNwbGF5ZWQgc28gd2UgYWxzbyBkaXNwbGF5IHRoZSBvcHRpb25cclxuICAgICAgICAgICAgICAgICAgICBpZiAoJChcIiNcIiArIE1vZC5kb21JZChjcmFmdGluZ2JlbmNob3B0aW9uLk1vZHNLZXkpKS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFyICRvcHRpb24gPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcIi5jcmFmdGluZ2JlbmNob3B0aW9uXCIsICRjcmFmdGluZ2JlbmNob3B0aW9ucyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAkb3B0aW9uLnZhbChpKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJG9wdGlvbi50ZXh0KGNyYWZ0aW5nYmVuY2hvcHRpb24uTmFtZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAkY3JhZnRpbmdiZW5jaG9wdGlvbnMuYXBwZW5kKCRvcHRpb24pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBkaXNwbGF5IG5vIG9wdGlvbnMgaGludFxyXG4gICAgICAgICAgICAgICAgJChcIiNub19jcmFmdGluZ2JlbmNob3B0aW9uc1wiKS50b2dnbGUoJChcIi5jcmFmdGluZ2JlbmNob3B0aW9uOm5vdCgudGVtcGxhdGUpXCIpLmxlbmd0aCA9PT0gMCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIHNlbGVjdCBsYXN0IG9wdGlvbiBiZWNhdXNlIG90aGVyd2lzZSBhIHJlY2VudGx5IGhpZGRlblxyXG4gICAgICAgICAgICAgICAgLy8gI25vX2NyYWZ0aW5nYmVuY2hvcHRpb25zIHdpbGwgc3RpbGwgYmUgc2VsZWN0ZWQgaW4gY2hyb21lXHJcbiAgICAgICAgICAgICAgICAvLyBhbHNvIHNlbGVjdGluZyBmaXJzdCB2aXNpYmxlIHlpZWxkcyB0byB3ZWlyZCBpbnRlcmFjdGlvbnNcclxuICAgICAgICAgICAgICAgIC8vIHdpdGggaGlkZGVuIG9wdGlvbnMgXHJcbiAgICAgICAgICAgICAgICAkKFwib3B0aW9uOmxhc3RcIiwgJGNyYWZ0aW5nYmVuY2hvcHRpb25zKS5wcm9wKFwic2VsZWN0ZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICAkY3JhZnRpbmdiZW5jaG9wdGlvbnMudHJpZ2dlcihcImNoYW5nZVwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJChcImlucHV0OnJhZGlvLk1vZEdlbmVyYXRvclwiKS5wYXJlbnRzKFwiLmFwcGxpY2FibGVcIikucmVtb3ZlQ2xhc3MoXCJzZWxlY3RlZFwiKTtcclxuICAgICAgICAgICAgLy8gYWRkIHNlbGVjdGVkIGNsYXNzIHRvIC5hcHBsaWNhYmxlIGNvbnRhaW5lclxyXG4gICAgICAgICAgICAkKFwiaW5wdXQ6cmFkaW86Y2hlY2tlZC5Nb2RHZW5lcmF0b3JcIikucGFyZW50cyhcIi5hcHBsaWNhYmxlXCIpLmFkZENsYXNzKFwic2VsZWN0ZWRcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGNoYW5nZWQgY3JhZnRpbmdiZW5jaG9wdGlvbiBoYW5kbGVcclxuICAgICAgICAkKFwiI2NyYWZ0aW5nYmVuY2hvcHRpb25zXCIpLm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJChcIiN1c2VfbW9kX2dlbiAuY3JhZnRpbmdiZW5jaG9wdGlvblwiKS50ZXh0KCQoXCJvcHRpb246c2VsZWN0ZWRcIiwgdGhpcykudGV4dCgpKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBtb2QgZ2VuIGhhbmRsZVxyXG4gICAgICAgICQoXCIjdXNlX21vZF9nZW5cIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciBhcmdzO1xyXG4gICAgICAgICAgICB2YXIgJHRoaXMgPSAkKHRoaXMpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc29sZS5sb2cobW9kX2dlbmVyYXRvciwgXCJAXCIsIGJhc2VpdGVtKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghKG1vZF9nZW5lcmF0b3IgaW5zdGFuY2VvZiBNb2RHZW5lcmF0b3IpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIm1vZF9nZW5lcmF0b3IgbmVlZHMgdG8gYmUgb2YgdHlwZSBNb2RHZW5lcmF0b3JcIik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghKGJhc2VpdGVtIGluc3RhbmNlb2YgSXRlbSkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiYmFzZWl0ZW0gbmVlZHMgdG8gYmUgb2YgdHlwZSBJdGVtXCIpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBidWlsZCBhcHBseVRvIGFyZ3NcclxuICAgICAgICAgICAgYXJncyA9IFtiYXNlaXRlbV07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyB3ZSBuZWVkIHRoZSBzZWxlY3RlZCBjcmFmdGluZ2JlbmNob3B0aW9uXHJcbiAgICAgICAgICAgIGlmIChtb2RfZ2VuZXJhdG9yIGluc3RhbmNlb2YgTWFzdGVyYmVuY2gpIHtcclxuICAgICAgICAgICAgICAgIGFyZ3MucHVzaCgrJChcIiNjcmFmdGluZ2JlbmNob3B0aW9ucyBvcHRpb246c2VsZWN0ZWRcIikudmFsKCkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBhcHBseVxyXG4gICAgICAgICAgICBpZiAobW9kX2dlbmVyYXRvci5hcHBseVRvLmFwcGx5KG1vZF9nZW5lcmF0b3IsIGFyZ3MpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBkaXNwbGF5XHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5X2Jhc2VpdGVtKGJhc2VpdGVtLCBcIiN1c2VkX2Jhc2VpdGVtXCIpO1xyXG4gICAgICAgICAgICAgICAgZGlzcGxheV9hdmFpbGFibGVfbW9kcyhtb2RfZ2VuZXJhdG9yLCBiYXNlaXRlbSk7XHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5X21vZF9nZW5fYXBwbGljYWJpbGl0eShiYXNlaXRlbSwgbW9kcyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICR0aGlzLmF0dHIoXCJkYXRhLWFwcGxpY2FibGVcIiwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBmbGFzaCBlcnJvclxyXG4gICAgICAgICAgICAgICAgJHRoaXMuYXR0cihcImRhdGEtYXBwbGljYWJsZVwiLCBmYWxzZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGRpc3BsYXkgbW9kIGdyb3VwXHJcbiAgICAgICAgJChcIiNhdmFpbGFibGVfbW9kcyB0Ym9keS5jb3JyZWN0X2dyb3VwXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKHRoaXMpLnRvZ2dsZUNsYXNzKFwiY2xpY2tlZFwiKS5uZXh0KCkudG9nZ2xlKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZGlzcGxheSBpbXBsY2l0c1xyXG4gICAgICAgICQoXCIjaW1wbGljaXRzLWNhcHRpb25cIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQodGhpcykudG9nZ2xlQ2xhc3MoXCJjbGlja2VkXCIpLnBhcmVudHMoXCJ0YWJsZVwiKS5jaGlsZHJlbihcInRib2R5XCIpLnRvZ2dsZSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGpRdWVyeSBUYWJsZXNvcnRlciBjb25maWdcclxuICAgICAgICAkKFwiI3ByZWZpeGVzLCAjc3VmZml4ZXMsICNpbXBsaWNpdHNcIikudGFibGVzb3J0ZXIoe1xyXG4gICAgICAgICAgICBjc3NJbmZvQmxvY2sgOiBcInRhYmxlc29ydGVyLW5vLXNvcnRcIlxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGFkZCBtb2RcclxuICAgICAgICAkKFwiLmFkZF9tb2RcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIC8vIGFzc2VydCBiYXNlaXRlbSBpbnN0YW5jZW9mIGJhc2VpdGVtXHJcbiAgICAgICAgICAgIHZhciBzZXJpYWxpemVkID0gJCh0aGlzKS5wYXJlbnRzKFwidHJcIikuZGF0YShcIm1vZFwiKTtcclxuICAgICAgICAgICAgdmFyIG1vZCA9IE1vZEZhY3RvcnkuZGVzZXJpYWxpemUoc2VyaWFsaXplZCk7XHJcbiAgICAgICAgICAgIHZhciBhZGRlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG1vZCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJjb3VsZCBub3QgZGVzZXJpYWxpemVcIiwgc2VyaWFsaXplZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc29sZS5sb2coYmFzZWl0ZW0sIFwiK1wiLCBtb2QpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgYWRkZWQgPSBiYXNlaXRlbS5hZGRNb2QobW9kKTtcclxuICAgICAgICAgICAgLy8gdHJ5IGF0IGxlYXN0IG9uZSB0aW1lIHRvIG1ha2UgbW9yZSByb29tIGZvciBtb2RzXHJcbiAgICAgICAgICAgIGlmICghYWRkZWQgJiYgYmFzZWl0ZW0udXBncmFkZVJhcml0eSgpKSB7XHJcbiAgICAgICAgICAgICAgICBhZGRlZCA9IGJhc2VpdGVtLmFkZE1vZChtb2QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYWRkZWQpIHtcclxuICAgICAgICAgICAgICAgIGRpc3BsYXlfYmFzZWl0ZW0oYmFzZWl0ZW0sIFwiI3VzZWRfYmFzZWl0ZW1cIik7XHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5X2F2YWlsYWJsZV9tb2RzKG1vZF9nZW5lcmF0b3IsIGJhc2VpdGVtKTtcclxuICAgICAgICAgICAgICAgIGRpc3BsYXlfbW9kX2dlbl9hcHBsaWNhYmlsaXR5KGJhc2VpdGVtLCBtb2RzKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIFRPRE8gZmxhc2ggZXJyb3JcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHJlbW92ZSBtb2RcclxuICAgICAgICAkKFwiLnJlbW92ZV9tb2RcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciAkbW9kID0gJCh0aGlzKS5wYXJlbnRzKFwiLm1vZFwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJlbW92ZU1vZChiYXNlaXRlbS5nZXRNb2QoJG1vZC5kYXRhKFwicHJpbWFyeVwiKSkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZGlzcGxheV9iYXNlaXRlbShiYXNlaXRlbSwgXCIjdXNlZF9iYXNlaXRlbVwiKTtcclxuICAgICAgICAgICAgZGlzcGxheV9hdmFpbGFibGVfbW9kcyhtb2RfZ2VuZXJhdG9yLCBiYXNlaXRlbSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gaWx2bCBoYW5kbGVcclxuICAgICAgICAkKFwiaW5wdXQuaWx2bFwiKS5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGJhc2VpdGVtLml0ZW1fbGV2ZWwgPSArJCh0aGlzKS52YWwoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRpc3BsYXlfYXZhaWxhYmxlX21vZHMobW9kX2dlbmVyYXRvciwgYmFzZWl0ZW0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHJhcml0eSBoYW5kbGVcclxuICAgICAgICAkKFwiI2l0ZW1fcmFyaXRpZXNcIikub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWVskKFwib3B0aW9uOnNlbGVjdGVkXCIsIHRoaXMpLnZhbCgpXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGRpc3BsYXlfYmFzZWl0ZW0oYmFzZWl0ZW0sIFwiI3VzZWRfYmFzZWl0ZW1cIik7XHJcbiAgICAgICAgICAgIGRpc3BsYXlfYXZhaWxhYmxlX21vZHMobW9kX2dlbmVyYXRvciwgYmFzZWl0ZW0pO1xyXG4gICAgICAgICAgICBkaXNwbGF5X21vZF9nZW5fYXBwbGljYWJpbGl0eShiYXNlaXRlbSwgbW9kcyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZXhwYW5kIG1vZCBncm91cHNcclxuICAgICAgICAkKFwiI2V4cGFuZF9tb2RzXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImV4cGFuZFwiKTtcclxuICAgICAgICAgICAgJChcInRhYmxlLm1vZHNcIikuYWRkQ2xhc3MoXCJleHBhbmRlZFwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICQoXCJ0Ym9keS5tb2RzOm5vdCgudGVtcGxhdGUpXCIpLnNob3coKTtcclxuICAgICAgICAgICAgJChcInRib2R5LmNvcnJlY3RfZ3JvdXA6bm90KC50ZW1wbGF0ZSlcIikuaGlkZSgpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyBjb2xsYXBzZSBtb2QgZ3JvdXBzID0gaW52ZXJ0ICNleHBhbmRfbW9kc1xyXG4gICAgICAgICQoXCIjY29sbGFwc2VfbW9kc1wiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJChcInRhYmxlLm1vZHNcIikucmVtb3ZlQ2xhc3MoXCJleHBhbmRlZFwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICQoXCJ0Ym9keS5tb2RzOm5vdCgudGVtcGxhdGUpXCIpLmhpZGUoKTtcclxuICAgICAgICAgICAgJChcInRib2R5LmNvcnJlY3RfZ3JvdXA6bm90KC50ZW1wbGF0ZSlcIikuc2hvdygpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGRpc3BsYXkgc3RhdHMgd2l0aCBtb2RzIGluIGl0ZW1ib3ggaGFuZGxlXHJcbiAgICAgICAgJChcIiNpdGVtYm94X3N0YXRzX3dpdGhfbW9kc1wiKS5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQoXCIuaXRlbWJveCAubW9kcyAubW9kID4gKjpub3QoLnN0YXRzKVwiKS50b2dnbGUoJCh0aGlzKS5wcm9wKFwiY2hlY2tlZFwiKSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZGlzcGxheSBncm91cCBvZiBNb2RHZW5lcmF0b3JzIGhhbmRsZVxyXG4gICAgICAgICQoXCIjc2hvd19jdXJyZW5jaWVzXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKFwiI01vZEdlbmVyYXRvciBmaWVsZHNldC5jdXJyZW5jaWVzXCIpLnRvZ2dsZSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgICQoXCIjc2hvd19tYXN0ZXJiZW5jaGVzXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKFwiI01vZEdlbmVyYXRvciBmaWVsZHNldC5tYXN0ZXJiZW5jaGVzXCIpLnRvZ2dsZSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGhpZGUgZ3JvdXAgb2YgTW9kR2VuZXJhdG9ycyBoYW5kbGVcclxuICAgICAgICAkKFwiI01vZEdlbmVyYXRvciBmaWVsZHNldCBhLmNsb3NlX2ZpZWxkc2V0XCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKHRoaXMpLnBhcmVudHMoXCJmaWVsZHNldFwiKS5oaWRlKCk7IFxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGl0ZW1fZml4ZWRfdG9wID0gJChcIiNJdGVtXCIpLm9mZnNldCgpLnRvcDtcclxuICAgICAgICBcclxuICAgICAgICAvLyAjSXRlbSBmaXhlZFxyXG4gICAgICAgICQod2luZG93KS5vbihcInNjcm9sbFwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciAkd2luZG93ID0gJCh3aW5kb3cpO1xyXG4gICAgICAgICAgICB2YXIgJEl0ZW0gPSAkKFwiI0l0ZW1cIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgb2Zmc2V0ID0gJHdpbmRvdy5zY3JvbGxUb3AoKSAtIGl0ZW1fZml4ZWRfdG9wO1xyXG4gICAgICAgICAgICBpZiAob2Zmc2V0ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgJEl0ZW0uY3NzKHt0b3A6IG9mZnNldCArIFwicHhcIn0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gdGVzdCBkb20gaGFuZGxlc1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGFsbCBhZmZpeGVzIHNlbGVjdGVkIGJ5IGRlZmF1bHRcclxuICAgICAgICAkKFwiaW5wdXQuTW9kR2VuZXJhdG9yOnJhZGlvXCIpLmZpbHRlcihcIjpmaXJzdFwiKS5wcm9wKFwiY2hlY2tlZFwiLCB0cnVlKTtcclxuICAgICAgICAkKFwiaW5wdXQuTW9kR2VuZXJhdG9yOnJhZGlvXCIpLmZpbHRlcihcIjpjaGVja2VkXCIpLnRyaWdnZXIoXCJjaGFuZ2VcIik7XHJcblxyXG4gICAgICAgIC8vJChcIiNwcmVmaXhlcyB0Ym9keTpub3QoLnRlbXBsYXRlKSAuYWRkX21vZDpmaXJzdFwiKS50cmlnZ2VyKFwiY2xpY2tcIik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgJChcIiN1c2VfbW9kX2dlblwiKS50cmlnZ2VyKFwiY2xpY2tcIik7XHJcbiAgICB9KTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuL0luaGVyaXRhbmNlJyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogaW50ZXJmYWNlIEFwcGxpY2FibGVcclxuICAgICAqL1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVzZXRBcHBsaWNhYmxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGxpY2FibGVDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEFwcGxpY2FibGUubWFwID0gZnVuY3Rpb24gKG1vZF9jb2xsZWN0aW9uLCBtb2RfY29udGFpbmVyKSB7XHJcbiAgICAgICAgcmV0dXJuICQubWFwKG1vZF9jb2xsZWN0aW9uLnNsaWNlKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgaWYgKEFwcGxpY2FibGUuaW1wbGVtZW50ZWRCeShtb2QpKSB7XHJcbiAgICAgICAgICAgICAgICBtb2QuYXBwbGljYWJsZVRvKG1vZF9jb250YWluZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBtb2Q7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBBcHBsaWNhYmxlLm1vZHMgPSBmdW5jdGlvbiAobW9kX2NvbGxlY3Rpb24sIG1vZF9jb250YWluZXIsIHN1Y2Nlc3MpIHtcclxuICAgICAgICByZXR1cm4gJC5ncmVwKG1vZF9jb2xsZWN0aW9uLnNsaWNlKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEFwcGxpY2FibGUuaW1wbGVtZW50ZWRCeShtb2QpICYmIG1vZC5hcHBsaWNhYmxlVG8obW9kX2NvbnRhaW5lciwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBpbnRlcmZhY2UgcGF0dGVyblxyXG4gICAgQXBwbGljYWJsZS5pbXBsZW1lbnRlZEJ5ID0gZnVuY3Rpb24gKGNsYXp6KSB7XHJcbiAgICAgICAgcmV0dXJuICBjbGF6ei5hcHBsaWNhYmxlVG8gIT09IF9fdW5kZWZpbmVkO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgQXBwbGljYWJsZS5VTlNDQU5ORUQgPSAwO1xyXG4gICAgQXBwbGljYWJsZS5TVUNDRVNTID0gMTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBBcHBsaWNhYmxlO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4vSW5oZXJpdGFuY2UnKTtcclxuICAgIHJlcXVpcmUoJy4vY29uY2VybnMvQXJyYXknKTtcclxuICAgIFxyXG4gICAgaWYgKHdpbmRvdy5qUXVlcnkgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIm5lZWQgalF1ZXJ5IG9iamVjdCB3aXRoIHdpbmRvdyBjb250ZXh0XCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHZhciAkID0gd2luZG93LmpRdWVyeTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBEYXRhRGVwZW5kZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiBjbGFzcyBmb3IgbG9hZGluZyBhIGpzb24gZGF0YVxyXG4gICAgICovXHJcbiAgICB2YXIgRGF0YURlcGVuZGVuY3kgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIHBhdGggdG8ganNvbiBkYXRhXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGxvYWRpbmdfaW5kaWNhdG9yIGpxdWVyeSBzZWxlY3RvciBmb3IgbG9hZGluZyBpbmRpY2F0b3IgY2xhc3NcclxuICAgICAgICAgKiBAcmV0dXJucyB7RGF0YURlcGVuZGVuY3l9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHBhdGgsIGxvYWRpbmdfaW5kaWNhdG9yKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IHBhdGg7XHJcbiAgICAgICAgICAgIHRoaXMubG9hZGluZ19pbmRpY2F0b3IgPSBsb2FkaW5nX2luZGljYXRvcjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuc3RhdGVfYXR0ciA9IERhdGFEZXBlbmRlbmN5LlNUQVRFX0FUVFI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiByZXR1cm5zICQuZ2V0SlNPTiBcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBkb25lIGNhbGxiYWNrIG9uICQuYWpheC5kb25lXHJcbiAgICAgICAgICogQHJldHVybnMgeyQuRGVyZWZlcnJlZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRKU09OOiBmdW5jdGlvbiAoZG9uZSkge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgICQodGhpcy5sb2FkaW5nX2luZGljYXRvcikuYXR0cih0aGlzLnN0YXRlX2F0dHIsIERhdGFEZXBlbmRlbmN5LlNUQVRFLkxPQURJTkcpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICQuZ2V0SlNPTih0aGlzLnBhdGgsIGRvbmUpXHJcbiAgICAgICAgICAgICAgICAuZG9uZShmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgJCh0aGF0LmxvYWRpbmdfaW5kaWNhdG9yKS5hdHRyKHRoYXQuc3RhdGVfYXR0ciwgRGF0YURlcGVuZGVuY3kuU1RBVEUuRE9ORSk7XHJcbiAgICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAgICAgLmZhaWwoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgICQodGhhdC5sb2FkaW5nX2luZGljYXRvcikuYXR0cih0aGF0LnN0YXRlX2F0dHIsIERhdGFEZXBlbmRlbmN5LlNUQVRFLkZBSUwpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIERhdGFEZXBlbmRlbmN5LlNUQVRFID0ge1xyXG4gICAgICAgIExPQURJTkc6IDEsXHJcbiAgICAgICAgRE9ORTogMixcclxuICAgICAgICBGQUlMOiAzXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGRlZmF1bHQgbG9hZGluZyBzdGF0ZSBhdHRyXHJcbiAgICAgKi9cclxuICAgIERhdGFEZXBlbmRlbmN5LlNUQVRFX0FUVFIgPSBcImRhdGEtbG9hZGluZy1zdGF0ZVwiO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IERhdGFEZXBlbmRlbmN5O1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4uL0luaGVyaXRhbmNlJyk7XHJcbiAgICBcclxuICAgIHZhciBOb3RGb3VuZEV4Y2VwdGlvbiA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKG1zZykge1xyXG4gICAgICAgICAgICB0aGlzLm1lc3NhZ2UgID0gbXNnO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE5vdEZvdW5kRXhjZXB0aW9uO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4vSW5oZXJpdGFuY2UnKTtcclxuICAgIHJlcXVpcmUoJy4vY29uY2VybnMvQXJyYXknKTtcclxuICAgIFxyXG4gICAgaWYgKCQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdmFyICQgPSByZXF1aXJlKCcuL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIHRhYmxlIHJvdyBmcm9tIGNvbnRlbnQuZ2dwa1xyXG4gICAgICovXHJcbiAgICB2YXIgR2dwa0VudHJ5ID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAocHJvcHMpIHtcclxuICAgICAgICAgICAgdGhpcy5wcm9wcyA9IHByb3BzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY29tbWEgc2VwYXJhdGVkIHZhbHVlcyBhcmUgYXJyYXlzXHJcbiAgICAgICAgICogYWxyZWFkeSBpbnQgY2FzdCBpZiBwb3NzaWJsZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdmFsdWVBc0FycmF5OiBmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICAgICAgICAgIC8vIGZpbHRlcihlbXB0eSkgKyBtYXAocGFyc2VJbnQpXHJcbiAgICAgICAgICAgIHJldHVybiAkLm1hcCh0aGlzLmdldFByb3Aoa2V5KS5zcGxpdChcIixcIiksIGZ1bmN0aW9uIChuKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobiA9PT0gbnVsbCB8fCBuID09PSAnJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoaXNOYU4oK24pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG47XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gK247XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZ2V0UHJvcDogZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wcm9wc1trZXldID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJrZXkgYFwiICsga2V5ICsgXCJgIGRvZXNudCBleGlzdFwiKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9wc1trZXldO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc2V0UHJvcDogZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMucHJvcHNba2V5XSAhPT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJvcHNba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gR2dwa0VudHJ5O1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4vSW5oZXJpdGFuY2UnKTtcclxuICAgIHZhciBQYXRoID0gcmVxdWlyZSgnLi9QYXRoJyk7XHJcbiAgICBcclxuICAgIHZhciBIYXNoYmFuZyA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByZWZpeCkge1xyXG4gICAgICAgICAgICB0aGlzLnBhcmFtcyA9IHt9O1xyXG4gICAgICAgICAgICB0aGlzLnBhdGggPSBuZXcgUGF0aChcIlwiKTtcclxuICAgICAgICAgICAgdGhpcy5wcmVmaXggPSBwcmVmaXg7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLm9uX2NoYW5nZSA9IG51bGw7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBvbkNoYW5nZTogZnVuY3Rpb24gKGNiKSB7XHJcbiAgICAgICAgICAgIHRoaXMub25fY2hhbmdlID0gY2I7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB0cmlnZ2VyQ2hhbmdlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGhpcy5vbl9jaGFuZ2UgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm9uX2NoYW5nZS5hcHBseSh0aGlzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IGtleVxyXG4gICAgICAgICAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXHJcbiAgICAgICAgICogQHJldHVybnMge0hhc2hiYW5nfSB0aGlzIHRvIGNoYWluXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2V0UGFyYW1zOiBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xyXG4gICAgICAgICAgICB0aGlzLnBhcmFtc1trZXldID0gdmFsdWU7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBjaGFpbmFibGVcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRQYXRoOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGg7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtIYXNoYmFuZ30gdGhpcyB0byBjaGFpblxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNldFBhdGg6IGZ1bmN0aW9uIChwYXRoKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IG5ldyBQYXRoKHBhdGgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gY2hhaW5hYmxlXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ2VuZXJhdGVzIHVybCBmcm9tIGNsYXNzIHByb3BlcnRpZXNcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHVybDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgdXJsID0gXCIjXCIgKyB0aGlzLnByZWZpeCArIHRoaXMucGF0aDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghJC5pc0VtcHR5T2JqZWN0KHRoaXMucGFyYW1zKSkge1xyXG4gICAgICAgICAgICAgICAgdXJsICs9IFwiP1wiICsgSGFzaGJhbmcucXVlcnlfc3RyaW5nKHRoaXMucGFyYW1zKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHVybDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHBhcnNlOiBmdW5jdGlvbiAodXJsKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaW5pdCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB1cmwgIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIHVybF9tYXRjaCA9IHVybC5tYXRjaCgvIShbXFx3XFwvXSspKFxcPy4qKT8vKTtcclxuICAgICAgICAgICAgaWYgKHVybF9tYXRjaCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRQYXRoKHVybF9tYXRjaFsxXSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldFBhcmFtcyh1cmxfbWF0Y2hbMl0pO1xyXG4gICAgICAgICAgICAgICAgdGhpcy50cmlnZ2VyQ2hhbmdlKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgd2l0aFdpbmRvdzogZnVuY3Rpb24gKHdpbmRvdykge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZSh3aW5kb3cubG9jYXRpb24uaGFzaC5zbGljZSgxKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEhhc2hiYW5nLmZyb21XaW5kb3cgPSBmdW5jdGlvbiAod2luZG93KSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBIYXNoYmFuZygpLndpdGhXaW5kb3cod2luZG93KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEhhc2hiYW5nLnBhcnNlID0gZnVuY3Rpb24gKHVybCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgSGFzaGJhbmcucGFyc2UodXJsKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEhhc2hiYW5nLnF1ZXJ5X3N0cmluZyA9IGZ1bmN0aW9uIChwYXJhbXMpIHtcclxuICAgICAgICByZXR1cm4gJC5tYXAocGFyYW1zLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xyXG4gICAgICAgICAgICByZXR1cm4ga2V5ICsgXCI9XCIgKyB2YWx1ZTtcclxuICAgICAgICB9KS5qb2luKFwiJlwiKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gSGFzaGJhbmc7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyogU2ltcGxlIEphdmFTY3JpcHQgSW5oZXJpdGFuY2VcclxuICogQnkgSm9obiBSZXNpZyBodHRwOi8vZWpvaG4ub3JnL1xyXG4gKiBNSVQgTGljZW5zZWQuXHJcbiAqL1xyXG4vLyBJbnNwaXJlZCBieSBiYXNlMiBhbmQgUHJvdG90eXBlXHJcbihmdW5jdGlvbigpe1xyXG4gIHZhciBpbml0aWFsaXppbmcgPSBmYWxzZSwgZm5UZXN0ID0gL3h5ei8udGVzdChmdW5jdGlvbigpe3h5ejt9KSA/IC9cXGJfc3VwZXJcXGIvIDogLy4qLztcclxuIFxyXG4gIC8vIFRoZSBiYXNlIENsYXNzIGltcGxlbWVudGF0aW9uIChkb2VzIG5vdGhpbmcpXHJcbiAgdmFyIENsYXNzID0gZnVuY3Rpb24oKXt9O1xyXG4gXHJcbiAgLy8gQ3JlYXRlIGEgbmV3IENsYXNzIHRoYXQgaW5oZXJpdHMgZnJvbSB0aGlzIGNsYXNzXHJcbiAgQ2xhc3MuZXh0ZW5kID0gZnVuY3Rpb24ocHJvcCkge1xyXG4gICAgdmFyIF9zdXBlciA9IHRoaXMucHJvdG90eXBlO1xyXG4gICBcclxuICAgIC8vIEluc3RhbnRpYXRlIGEgYmFzZSBjbGFzcyAoYnV0IG9ubHkgY3JlYXRlIHRoZSBpbnN0YW5jZSxcclxuICAgIC8vIGRvbid0IHJ1biB0aGUgaW5pdCBjb25zdHJ1Y3RvcilcclxuICAgIGluaXRpYWxpemluZyA9IHRydWU7XHJcbiAgICB2YXIgcHJvdG90eXBlID0gbmV3IHRoaXMoKTtcclxuICAgIGluaXRpYWxpemluZyA9IGZhbHNlO1xyXG4gICBcclxuICAgIC8vIENvcHkgdGhlIHByb3BlcnRpZXMgb3ZlciBvbnRvIHRoZSBuZXcgcHJvdG90eXBlXHJcbiAgICBmb3IgKHZhciBuYW1lIGluIHByb3ApIHtcclxuICAgICAgLy8gQ2hlY2sgaWYgd2UncmUgb3ZlcndyaXRpbmcgYW4gZXhpc3RpbmcgZnVuY3Rpb25cclxuICAgICAgcHJvdG90eXBlW25hbWVdID0gdHlwZW9mIHByb3BbbmFtZV0gPT0gXCJmdW5jdGlvblwiICYmXHJcbiAgICAgICAgdHlwZW9mIF9zdXBlcltuYW1lXSA9PSBcImZ1bmN0aW9uXCIgJiYgZm5UZXN0LnRlc3QocHJvcFtuYW1lXSkgP1xyXG4gICAgICAgIChmdW5jdGlvbihuYW1lLCBmbil7XHJcbiAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHZhciB0bXAgPSB0aGlzLl9zdXBlcjtcclxuICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQWRkIGEgbmV3IC5fc3VwZXIoKSBtZXRob2QgdGhhdCBpcyB0aGUgc2FtZSBtZXRob2RcclxuICAgICAgICAgICAgLy8gYnV0IG9uIHRoZSBzdXBlci1jbGFzc1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlciA9IF9zdXBlcltuYW1lXTtcclxuICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gVGhlIG1ldGhvZCBvbmx5IG5lZWQgdG8gYmUgYm91bmQgdGVtcG9yYXJpbHksIHNvIHdlXHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBpdCB3aGVuIHdlJ3JlIGRvbmUgZXhlY3V0aW5nXHJcbiAgICAgICAgICAgIHZhciByZXQgPSBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpOyAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyID0gdG1wO1xyXG4gICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gcmV0O1xyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9KShuYW1lLCBwcm9wW25hbWVdKSA6XHJcbiAgICAgICAgcHJvcFtuYW1lXTtcclxuICAgIH1cclxuICAgXHJcbiAgICAvLyBUaGUgZHVtbXkgY2xhc3MgY29uc3RydWN0b3JcclxuICAgIGZ1bmN0aW9uIENsYXNzKCkge1xyXG4gICAgICAvLyBBbGwgY29uc3RydWN0aW9uIGlzIGFjdHVhbGx5IGRvbmUgaW4gdGhlIGluaXQgbWV0aG9kXHJcbiAgICAgIGlmICggIWluaXRpYWxpemluZyAmJiB0aGlzLmluaXQgKVxyXG4gICAgICAgIHRoaXMuaW5pdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgfVxyXG4gICBcclxuICAgIC8vIFBvcHVsYXRlIG91ciBjb25zdHJ1Y3RlZCBwcm90b3R5cGUgb2JqZWN0XHJcbiAgICBDbGFzcy5wcm90b3R5cGUgPSBwcm90b3R5cGU7XHJcbiAgIFxyXG4gICAgLy8gRW5mb3JjZSB0aGUgY29uc3RydWN0b3IgdG8gYmUgd2hhdCB3ZSBleHBlY3RcclxuICAgIENsYXNzLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IENsYXNzO1xyXG4gXHJcbiAgICAvLyBBbmQgbWFrZSB0aGlzIGNsYXNzIGV4dGVuZGFibGVcclxuICAgIENsYXNzLmV4dGVuZCA9IGFyZ3VtZW50cy5jYWxsZWU7XHJcbiAgIFxyXG4gICAgcmV0dXJuIENsYXNzO1xyXG4gIH07XHJcbiAgXHJcbiAgbW9kdWxlLmV4cG9ydHMgPSBDbGFzcztcclxufSkoKTsiLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKFwiLi9Jbmhlcml0YW5jZVwiKTtcclxuICAgIFxyXG4gICAgcmVxdWlyZSgnLi9jb25jZXJucy9BcnJheScpO1xyXG4gICAgcmVxdWlyZSgnLi9jb25jZXJucy9PYmplY3QnKTtcclxuICAgIFxyXG4gICAgaWYgKCQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdmFyICQgPSByZXF1aXJlKCcuL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIExvY2FsaXphdGlvblxyXG4gICAgICogXHJcbiAgICAgKiBjbGFzcyBmb3IgbG9jYWxpemluZyBhIGdyb3VwIG9mIGVudGl0aWVzXHJcbiAgICAgKi9cclxuICAgIHZhciBMb2NhbGl6YXRpb24gPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBkYXRhIHRoZSBsb2NhbGl6YXRpb24ganNvbiBkYXRhXHJcbiAgICAgICAgICogQHJldHVybnMge0xvY2FsaXphdGlvbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleVxyXG4gICAgICAgICAqIEBwYXJhbSB7Kn0gLi4uYXJncyBwYXJhbXMgZm9yIExvY2FsaXphdGlvbjo6bG9va3VwU3RyaW5nXHJcbiAgICAgICAgICogQHJldHVybnMge0xvY2FsaXphdGlvbjo6bG9va3VwU3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHQ6IGZ1bmN0aW9uIChrZXkpIHtcclxuICAgICAgICAgICAgdmFyIHBhcmFtcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XHJcbiAgICAgICAgICAgIHJldHVybiBMb2NhbGl6YXRpb24uZmlsbFN0cmluZyh0aGlzLmxvb2t1cFN0cmluZyhrZXksIHBhcmFtcyksIHBhcmFtcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBjaGVja3MgYWxsIHBvc3NpYmxlIHN0cmluZ3MgZnJvbSBrZXkgYWdhaW5zdCB0aGUgcGFyYW1zXHJcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleVxyXG4gICAgICAgICAqIEBwYXJhbSB7YXJyYXl9IHBhcmFtc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R8Q2xhc3NAY2FsbDtleHRlbmQuZmlsbFN0cmluZy5zdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbG9va3VwU3RyaW5nOiBmdW5jdGlvbiAoa2V5LCBwYXJhbXMpIHtcclxuICAgICAgICAgICAgdmFyIHVzZWRfb3B0aW9uID0gbnVsbDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmRhdGFba2V5XSA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBldmVyeSBvcHRpb25cclxuICAgICAgICAgICAgJC5lYWNoKHRoaXMuZGF0YVtrZXldLCBmdW5jdGlvbiAoaSwgb3B0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaXNOYU4oK2kpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY29udGludWUgb24gc3RyaW5nIGtleXNcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGFuZF9iaXQgPSAxO1xyXG4gICAgICAgICAgICAgICAgLy8gbG9vcCB0aHJvdWdoIGV2ZXJ5IGFuZCBjb25kaXRpb25cclxuICAgICAgICAgICAgICAgICQuZWFjaChvcHRpb24uYW5kLCBmdW5jdGlvbiAoaiwgcmFuZ2Vfc3RyaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYW5kX2JpdCAmPSArTG9jYWxpemF0aW9uLmluUmFuZ2UocmFuZ2Vfc3RyaW5nLCBwYXJhbXNbal0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghYW5kX2JpdCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoYW5kX2JpdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHVzZWRfb3B0aW9uID0gb3B0aW9uO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodXNlZF9vcHRpb24gPT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coXCJubyB2YWxpZCBtYXRjaCBmb3JcIiwgdGhpcy5kYXRhW2tleV0sIFwid2l0aFwiLCBwYXJhbXMpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKHVzZWRfb3B0aW9uLmhhbmRsZXMpIHtcclxuICAgICAgICAgICAgICAgICQuZWFjaCh1c2VkX29wdGlvbi5oYW5kbGVzLCBmdW5jdGlvbiAoaSwgaGFuZGxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zW2ktMV0gPSAkLm1hcChwYXJhbXNbaS0xXSwgTG9jYWxpemF0aW9uLmhhbmRsZXNbaGFuZGxlXSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF1c2VkX29wdGlvbi50ZXh0KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyh0aGlzLmRhdGFba2V5XSwgdXNlZF9vcHRpb24pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gdXNlZF9vcHRpb24udGV4dDtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiByZXBsYWNlcyB0aGUgcGFyYW1zIHdpdGhpbiB0aGUgc3RyaW5nIHdpdGggdGhlIGdpdmVuIHBhcmFtc1xyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBwYXJhbXNcclxuICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgKi9cclxuICAgIExvY2FsaXphdGlvbi5maWxsU3RyaW5nID0gZnVuY3Rpb24gKHN0cmluZywgcGFyYW1zKSB7XHJcbiAgICAgICAgJC5lYWNoKHBhcmFtcywgZnVuY3Rpb24gKGksIHBhcmFtKSB7XHJcbiAgICAgICAgICAgIHN0cmluZyA9IHN0cmluZy5yZXBsYWNlKFwie3BhcmFtX1wiICsgKGkgKyAxKSArIFwifVwiLCBMb2NhbGl6YXRpb24ucmFuZ2VTdHJpbmcocGFyYW0pKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gc3RyaW5nO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjaGVja3MgaWYgdmFsdWVzIGFyZSB3aXRoaW4gYSByYW5nZV9zdHJpbmcgZnJvbSB0aGUgcG9lIGRlc2MgZmlsZXMgXHJcbiAgICAgKiBAcGFyYW0ge3R5cGV9IHJhbmdlX3N0cmluZ1xyXG4gICAgICogQHBhcmFtIHt0eXBlfSB2YWx1ZXNcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICovXHJcbiAgICBMb2NhbGl6YXRpb24uaW5SYW5nZSA9IGZ1bmN0aW9uIChyYW5nZV9zdHJpbmcsIHZhbHVlcykge1xyXG4gICAgICAgIGlmIChyYW5nZV9zdHJpbmcgPT09IF9fdW5kZWZpbmVkIHx8IHZhbHVlcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgcmFuZ2UgPSByYW5nZV9zdHJpbmcuc3BsaXQoXCJ8XCIpO1xyXG4gICAgICAgIHZhciB2YWx1ZSA9IE1hdGgubWF4LmFwcGx5KE1hdGgsIHZhbHVlcyk7XHJcbiAgICAgICAgICAgICBcclxuICAgICAgICBpZiAocmFuZ2UubGVuZ3RoID09PSAxICYmICgrcmFuZ2VbMF0gPT09ICt2YWx1ZSB8fCByYW5nZVswXSA9PT0gJyMnKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHJhbmdlWzBdID09PSAnIycpIHtcclxuICAgICAgICAgICAgcmFuZ2VbMF0gPSBOdW1iZXIuTkVHQVRJVkVfSU5GSU5JVFk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChyYW5nZVsxXSA9PT0gJyMnKSB7XHJcbiAgICAgICAgICAgIHJhbmdlWzFdID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAoK3JhbmdlWzBdIDw9ICt2YWx1ZSAmJiArdmFsdWUgPD0gK3JhbmdlWzFdKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBMb2NhbGl6YXRpb24ucmFuZ2VTdHJpbmcgPSBmdW5jdGlvbiAocmFuZ2UpIHtcclxuICAgICAgICBpZiAocmFuZ2UubGVuZ3RoIDwgMiB8fCByYW5nZVswXSA9PT0gcmFuZ2VbMV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJhbmdlWzBdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gXCIoXCIgKyByYW5nZS5qb2luKFwiIHRvIFwiKSArIFwiKVwiO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBsYW1iZGFzICBmb3IgcGFyYW1ldGVyIGhhbmRsZXNcclxuICAgICAqL1xyXG4gICAgTG9jYWxpemF0aW9uLmhhbmRsZXMgPSB7XHJcbiAgICAgICAgZGVjaXNlY29uZHNfdG9fc2Vjb25kczogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGkgKiAxMDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGRpdmlkZV9ieV9vbmVfaHVuZHJlZDogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGkgLyAxMDA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBwZXJfbWludXRlX3RvX3Blcl9zZWNvbmQ6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpIC8gNjA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtaWxsaXNlY29uZHNfdG9fc2Vjb25kczogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGkgLyAxMDAwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmVnYXRlOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gLWk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkaXZpZGVfYnlfb25lX2h1bmRyZWRfYW5kX25lZ2F0ZTogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIC1pIC8gMTAwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgb2xkX2xlZWNoX3BlcmNlbnQ6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpIC8gNTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9sZF9sZWVjaF9wZXJteXJpYWQ6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBpIC8gNTA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBwZXJfbWludXRlX3RvX3Blcl9zZWNvbmRfMGRwOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoTWF0aC5yb3VuZChpIC8gNjAsIDApLCAxMCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBwZXJfbWludXRlX3RvX3Blcl9zZWNvbmRfMmRwOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoTWF0aC5yb3VuZChpIC8gNjAsIDIpLCAxMCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtaWxsaXNlY29uZHNfdG9fc2Vjb25kc18wZHA6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUludChNYXRoLnJvdW5kKGkgLyAxMDAwLCAwKSwgMTApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbWlsbGlzZWNvbmRzX3RvX3NlY29uZHNfMmRwOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcGFyc2VJbnQoTWF0aC5yb3VuZChpIC8gMTAwMCwgMiksIDEwKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG11bHRpcGxpY2F0aXZlX2RhbWFnZV9tb2RpZmllcjogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtb2RfdmFsdWVfdG9faXRlbV9jbGFzczogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBMb2NhbGl6YXRpb247XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIE1ldGFkYXRhXHJcbiAgICAgKiBcclxuICAgICAqIHJlcHJlc2VudGF0aW9uIG9mIGEgLm90IGZpbGUgaW4gTUVUQURBVEEgXHJcbiAgICAgKi9cclxuICAgIHZhciBNZXRhRGF0YSA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGNsYXp6LCBwcm9wcykge1xyXG4gICAgICAgICAgICB0aGlzLmNsYXp6ID0gY2xheno7XHJcbiAgICAgICAgICAgIHRoaXMucHJvcHMgPSBwcm9wcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzQTogZnVuY3Rpb24gKGNsYXp6KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjbGF6eiA9PT0gdGhpcy5jbGF6eiB8fCBcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb3BzLmluaGVyaXRhbmNlLmluZGV4T2YoY2xhenopICE9PSAtMTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHZhbHVlT2Y6IGZ1bmN0aW9uIChmYXNjYWRlLCBrZXksIGV4cGVjdCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wcm9wc1tmYXNjYWRlXSAmJiB0aGlzLnByb3BzW2Zhc2NhZGVdW2tleV0pIHtcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAoZXhwZWN0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBNZXRhRGF0YS5FWFBFQ1QuU1RSSU5HOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9wc1tmYXNjYWRlXVtrZXldWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgTWV0YURhdGEuRVhQRUNULk5VTUJFUjpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuICt0aGlzLnByb3BzW2Zhc2NhZGVdW2tleV1bMF07XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBNZXRhRGF0YS5FWFBFQ1QuQVJSQVk6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnByb3BzW2Zhc2NhZGVdW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJJbGxlZ2FsQXJndW1lbnQgZm9yIHZhbHVlT2YoZmFzY2FkZSwga2V5LCBleHBlY3QpXCIsIGZhc2NhZGUsIGtleSwgZXhwZWN0KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIF9fdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBNZXRhRGF0YS5idWlsZCA9IGZ1bmN0aW9uIChjbGF6eiwgbWV0YV9kYXRhcykge1xyXG4gICAgICAgIHZhciBtZXRhX2RhdGEgPSBtZXRhX2RhdGFzW2NsYXp6XTtcclxuICAgICAgICBpZiAobWV0YV9kYXRhID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIG5ldyBNZXRhRGF0YShjbGF6eiwgbWV0YV9kYXRhKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1ldGFEYXRhLkVYUEVDVCA9IHtcclxuICAgICAgICBOVU1CRVI6IDEsXHJcbiAgICAgICAgU1RSSU5HOiAyLFxyXG4gICAgICAgIEFSUkFZOiAzXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1ldGFEYXRhO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBNb2RDb250YWluZXIgPSByZXF1aXJlKCcuL01vZENvbnRhaW5lcicpO1xyXG4gICAgdmFyIE1ldGFEYXRhID0gcmVxdWlyZSgnLi4vTWV0YURhdGEnKTtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01vZCcpO1xyXG4gICAgdmFyIFZhbHVlUmFuZ2UgPSByZXF1aXJlKCcuLi9WYWx1ZVJhbmdlJyk7XHJcbiAgICB2YXIgR2dwa0VudHJ5ID0gcmVxdWlyZSgnLi4vR2dwa0VudHJ5Jyk7XHJcbiAgICB2YXIgSXRlbUltcGxpY2l0cyA9IHJlcXVpcmUoJy4vSXRlbUltcGxpY2l0cycpO1xyXG4gICAgdmFyIEFwcGxpY2FibGVNb2QgPSByZXF1aXJlKCcuLi9tb2RzL0FwcGxpY2FibGVNb2QnKTtcclxuICAgIFxyXG4gICAgaWYgKCQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEl0ZW0gQ2xhc3MgZXh0ZW5kcyBAbGluayBNb2RDb250YWluZXJcclxuICAgICAqIFxyXG4gICAgICogcmVwcmVzZW50cyBhbiBpbmdhbWUgaXRlbSAoYm9vdHMsIG1hcHMsIHJpbmdzIGZvciBleGFtcGxlKVxyXG4gICAgICogdGhlIGNsYXNzIG9ubHkgcmVwcmVzZW50cyB0aGUgZXhwbGljaXRzIGFuZCBpcyBhIGZhc2NhZGUgZm9yIGFuIFxyXG4gICAgICogYWRkaXRpb25hbCBpbXBsaWNpdCBjb250YWluZXJcclxuICAgICAqL1xyXG4gICAgdmFyIEl0ZW0gPSBNb2RDb250YWluZXIuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcHJvcHMgZm9yIEBsaW5rIEdncGtFbnRyeVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtJdGVtfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChwcm9wcykge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIGlmIChJdGVtLm1ldGFfZGF0YSA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJwbHMgaW5pdCBtZXRhIGRhdGFcIik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZXhwbGljaXRzXHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBkZWZhdWx0XHJcbiAgICAgICAgICAgIHRoaXMucmFyaXR5ID0gSXRlbS5SQVJJVFkuTk9STUFMO1xyXG4gICAgICAgICAgICB0aGlzLml0ZW1fbGV2ZWwgPSBJdGVtLk1BWF9JTFZMO1xyXG4gICAgICAgICAgICB0aGlzLnJhbmRvbV9uYW1lID0gXCJSYW5kb20gTmFtZVwiO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcGFyc2UgZW50cnlcclxuICAgICAgICAgICAgdGhpcy5lbnRyeSA9IG5ldyBHZ3BrRW50cnkocHJvcHMpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZ2V0IG1ldGEgZGF0YSBrZXlcclxuICAgICAgICAgICAgLy8gcGF0aC5zcGxpdCgvW1xcXFwvXS8pLnBvcCgpIDo9IGJhc2VuYW1lIFxyXG4gICAgICAgICAgICB2YXIgY2xhenogPSB0aGlzLmVudHJ5LmdldFByb3AoXCJJbmhlcml0c0Zyb21cIikuc3BsaXQoL1tcXFxcL10vKS5wb3AoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIG1ldGEgZGF0YSBleGlzdHM/XHJcbiAgICAgICAgICAgIHRoaXMubWV0YV9kYXRhID0gTWV0YURhdGEuYnVpbGQoY2xhenosIEl0ZW0ubWV0YV9kYXRhKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGltcGxpY2l0c1xyXG4gICAgICAgICAgICB0aGlzLmltcGxpY2l0cyA9IG5ldyBJdGVtSW1wbGljaXRzKFtdKTtcclxuICAgICAgICAgICAgJC5lYWNoKHRoaXMuZW50cnkudmFsdWVBc0FycmF5KFwiSW1wbGljaXRfTW9kc0tleXNcIiksIGZ1bmN0aW9uIChfLCBtb2Rfa2V5KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXRoYXQuaW1wbGljaXRzLmFkZE1vZChuZXcgQXBwbGljYWJsZU1vZChNb2QubW9kc1ttb2Rfa2V5XSkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJjb3VsZCBub3QgYWRkXCIsIG1vZF9rZXkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgYSBtb2QgaWYgdGhlcmVzIHJvb20gZm9yIGl0XHJcbiAgICAgICAgICogbm8gc29waGlzdGljYXRlZCBkb21haW4gY2hlY2suIG9ubHkgaWYgYWZmaXggdHlwZSBpcyBmdWxsIG9yIG5vdFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBvdmVycmlkZVxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kfSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBvbiBzdWNjZXNzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYWRkTW9kOiBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIGlmICghKG1vZCBpbnN0YW5jZW9mIE1vZCkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ21vZCBtdXN0IGJlIGluc3RhbmNlIG9mIGBNb2RgJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChtb2QuaXNQcmVmaXgoKSAmJiB0aGlzLmdldFByZWZpeGVzKCkubGVuZ3RoIDwgdGhpcy5tYXhQcmVmaXhlcygpIHx8IFxyXG4gICAgICAgICAgICAgICAgICAgIG1vZC5pc1N1ZmZpeCgpICYmIHRoaXMuZ2V0U3VmZml4ZXMoKS5sZW5ndGggPCB0aGlzLm1heFN1ZmZpeGVzKClcclxuICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fc3VwZXIobW9kKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAcGFyYW0ge01vZH0gbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFkZEltcGxpY2l0czogZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsaWNpdHMuYWRkTW9kKG1vZCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBJdGVtSW1wbGljdHMgZmFzY2FkZVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2RDb250YWluZXJAY2FsbDtyZW1vdmVBbGxNb2RzfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlbW92ZUFsbEltcGxpY2l0czogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsaWNpdHMucmVtb3ZlQWxsTW9kcygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogSXRlbUltcGxpY2l0cyBmYXNjYWRlXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2R9IG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2RDb250YWluZXJAY2FsbDtyZW1vdmVNb2R9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmVtb3ZlSW1wbGljaXRzOiBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGxpY2l0cy5yZW1vdmVNb2QobW9kKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEl0ZW1JbXBsaWNpdHMgZmFzY2FkZVxyXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBwcmltYXJ5XHJcbiAgICAgICAgICogQHJldHVybnMge01vZENvbnRhaW5lckBjYWxsO2dldE1vZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRJbXBsaWNpdDogZnVuY3Rpb24gKHByaW1hcnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGljaXRzLmdldE1vZChwcmltYXJ5KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEl0ZW1JbXBsaWNpdHMgZmFzY2FkZVxyXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBwcmltYXJ5XHJcbiAgICAgICAgICogQHJldHVybnMge01vZENvbnRhaW5lckBjYWxsO2luTW9kc31cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbkltcGxpY2l0czogZnVuY3Rpb24gKHByaW1hcnkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGljaXRzLmluTW9kcyhwcmltYXJ5KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgYSBuZXcgdGFnIHRvIHRoZSBpdGVtIGlmIGl0cyBub3QgYWxyZWFkeSBwcmVzZW5cclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge2ludH0gdGFnX2tleVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIHN1Y2Nlc3NcclxuICAgICAgICAgKi9cclxuICAgICAgICBhZGRUYWc6IGZ1bmN0aW9uICh0YWdfa2V5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnRhZ3MuaW5kZXhPZih0YWdfa2V5KSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudGFncy5wdXNoKHRhZ19rZXkpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcmVtb3ZlcyBhbiBleGlzdGluZyB0YWdcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge2ludH0gdGFnX2tleVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIHN1Y2Nlc3NcclxuICAgICAgICAgKi9cclxuICAgICAgICByZW1vdmVUYWc6IGZ1bmN0aW9uICh0YWdfa2V5KSB7XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMudGFncy5pbmRleE9mKHRhZ19rZXkpO1xyXG4gICAgICAgICAgICBpZiAoaW5kZXggIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRhZ3MgPSB0aGlzLnRhZ3Muc3BsaWNlKGluZGV4LCAxKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0YWdfa2V5O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHJldHVybnMgdGFncyBvZiBpdGVtICsgdGFncyBmcm9tIG1vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0VGFnczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJC51bmlxdWUodGhpcy5fc3VwZXIoKS5jb25jYXQodGhpcy5tZXRhX2RhdGEucHJvcHMudGFncywgdGhpcy5lbnRyeS52YWx1ZUFzQXJyYXkoXCJUYWdzS2V5c1wiKSkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcmV0dXJucyB0aGUgbWF4IHBvc3NpYmxlIG51bWJlciBvZiB0aGUgZ2l2ZW4gZ2VuZXJhdGlvbiB0eXBlXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQG92ZXJyaWRlXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2R9IG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IG1heCBudW1iZXIgb3IgLTEgaWYgbm90IHBvc3NpYmxlIGF0IGFsbFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1heE1vZHNPZlR5cGU6IGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgdmFyIGdlbmVyYXRpb25fdHlwZSA9ICttb2QuZ2V0UHJvcChcIkdlbmVyYXRpb25UeXBlXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgc3dpdGNoIChnZW5lcmF0aW9uX3R5cGUpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgTW9kLk1PRF9UWVBFLlBSRUZJWDpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhQcmVmaXhlcygpO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBNb2QuTU9EX1RZUEUuU1VGRklYOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFN1ZmZpeGVzKCk7XHJcbiAgICAgICAgICAgICAgICBjYXNlIE1vZC5NT0RfVFlQRS5FTkNIQU5UTUVOVDpcclxuICAgICAgICAgICAgICAgIGNhc2UgTW9kLk1PRF9UWVBFLlRBTElTTUFOOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBtYXhpbXVtIG51bWJlciBvZiBwcmVmaXhlc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWF4UHJlZml4ZXM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgc3dpdGNoICh0aGlzLnJhcml0eSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5OT1JNQUw6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDA7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLk1BR0lDOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5SQVJFOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5TSE9XQ0FTRTpcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5tZXRhX2RhdGEuaXNBKFwiQWJzdHJhY3RKZXdlbFwiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gMjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDM7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLlVOSVFVRTpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBtYXhpbXVtIG51bWJlciBvZiBzdWZmaXhlcyAoPXByZWZpeGVzKVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWF4U3VmZml4ZXM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4UHJlZml4ZXMoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGVxdWl2IG1vZCBkb21haW5cclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kLkRPTUFJTi4qfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZERvbWFpbkVxdWl2OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1ldGFfZGF0YS5pc0EoXCJBYnN0cmFjdEpld2VsXCIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTW9kLkRPTUFJTi5KRVdFTDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodGhpcy5tZXRhX2RhdGEuaXNBKFwiQWJzdHJhY3RGbGFza1wiKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1vZC5ET01BSU4uRkxBU0s7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRoaXMubWV0YV9kYXRhLmlzQShcIkFic3RyYWN0TWFwXCIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTW9kLkRPTUFJTi5NQVA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIE1vZC5ET01BSU4uSVRFTTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGNoZWNrcyBpZiB0aGUgZG9tYWlucyBhcmUgZXF1aXZcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge01vZC5ET01BSU4uKn0gbW9kX2RvbWFpblxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGluIGRvbWFpblxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluRG9tYWluT2Y6IGZ1bmN0aW9uIChtb2RfZG9tYWluKSB7XHJcbiAgICAgICAgICAgIHN3aXRjaCAobW9kX2RvbWFpbikge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBNb2QuRE9NQUlOLk1BU1RFUjpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5pbkRvbWFpbk9mKE1vZC5ET01BSU4uSVRFTSk7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBtb2RfZG9tYWluID09PSB0aGlzLm1vZERvbWFpbkVxdWl2KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldEltcGxpY2l0czogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsaWNpdHMuYXNBcnJheSgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZ2V0QWxsTW9kczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hc0FycmF5KCkuY29uY2F0KHRoaXMuZ2V0SW1wbGljaXRzKCkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbmFtZSBvZiB0aGUgYmFzZV9pdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBiYXNlTmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5yYXJpdHkgPT09IEl0ZW0uUkFSSVRZLk1BR0lDKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5lbnRyeS5nZXRQcm9wKFwiTmFtZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFjdHVhbCBpdGVtIG5hbWVcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGl0ZW1OYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHN3aXRjaCAodGhpcy5yYXJpdHkpIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuTUFHSUM6XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIG5hbWUgPSBcIlwiO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHByZWZpeFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLmdldFByZWZpeGVzKCkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWUgKz0gdGhpcy5nZXRQcmVmaXhlcygpWzBdLmdldFByb3AoXCJOYW1lXCIpICsgXCIgXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIC8vICsgYmFzZV9uYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgbmFtZSArPSB0aGlzLmVudHJ5LmdldFByb3AoXCJOYW1lXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vICsgc3VmZml4XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2V0U3VmZml4ZXMoKS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSArPSBcIiBcIiArIHRoaXMuZ2V0U3VmZml4ZXMoKVswXS5nZXRQcm9wKFwiTmFtZVwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5hbWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLlJBUkU6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucmFuZG9tX25hbWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcHJpbWFyeSBrZXlcclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHByaW1hcnk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICt0aGlzLmVudHJ5LmdldFByb3AoXCJSb3dzXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcmVxdWlyZW1lbnRzIHRvIHdlYXIgdGhpcyBpdGVtXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gcmVxdWlyZW1lbnQgZGVzYyA9PiBhbW91bnRcclxuICAgICAgICAgKi9cclxuICAgICAgICByZXF1aXJlbWVudHM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHJlcXVpcmVtZW50cyA9IHt9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJC5lYWNoKHtcclxuICAgICAgICAgICAgICAgIExldmVsOiB0aGlzLnJlcXVpcmVkTGV2ZWwoKSxcclxuICAgICAgICAgICAgICAgIFN0cjogdGhpcy5lbnRyeS5nZXRQcm9wKFwiUmVxU3RyXCIpLFxyXG4gICAgICAgICAgICAgICAgRGV4OiB0aGlzLmVudHJ5LmdldFByb3AoXCJSZXFEZXhcIiksXHJcbiAgICAgICAgICAgICAgICBJbnQ6IHRoaXMuZW50cnkuZ2V0UHJvcChcIlJlcUludFwiKVxyXG4gICAgICAgICAgICB9LCBmdW5jdGlvbiAoa2V5LCByZXF1aXJlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlcXVpcmVtZW50ID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlcXVpcmVtZW50c1trZXldID0gcmVxdWlyZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHJlcXVpcmVtZW50cztcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlcXVpcmVkTGV2ZWw6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIE1hdGgubWF4LmFwcGx5KE1hdGgsIFsrdGhpcy5lbnRyeS5nZXRQcm9wKFwiRHJvcExldmVsXCIpXS5jb25jYXQoJC5tYXAodGhpcy5nZXRBbGxNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBNYXRoLmZsb29yKDAuOCAqICttb2QuZ2V0UHJvcChcIkxldmVsXCIpKTtcclxuICAgICAgICAgICAgfSkpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHN0cmluZyBpZGVudGlmaWVyIG9mIHRoZSBpdGVtX2NsYXNzXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ30ga2V5IGZyb20gQGxpbmsgSXRlbS5JVEVNQ0xBU1NFU1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGl0ZW1jbGFzc0lkZW50OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICAgICAgcmV0dXJuICQubWFwKEl0ZW0uSVRFTUNMQVNTRVMsIGZ1bmN0aW9uIChpdGVtY2xhc3MsIGlkZW50KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoK2l0ZW1jbGFzcy5QUklNQVJZID09PSArdGhhdC5lbnRyeS5nZXRQcm9wKFwiSXRlbUNsYXNzXCIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlkZW50O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc3RyaW5nIGlkZW50aWZpZXIgb2YgdGhlIGl0ZW0gcmFyaXR5XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ30ga2V5IGZyb20gQGxpbmsgSXRlbS5SQVJJVFlcclxuICAgICAgICAgKi9cclxuICAgICAgICByYXJpdHlJZGVudDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIHJldHVybiAkLm1hcChJdGVtLlJBUklUWSwgZnVuY3Rpb24gKHJhcml0eSwgaWRlbnQpIHtcclxuICAgICAgICAgICAgICAgIGlmIChyYXJpdHkgPT09ICt0aGF0LnJhcml0eSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBpZGVudC50b0xvd2VyQ2FzZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYXR0ZW1wdHMgdG8gdXBncmFkZSB0aGUgcmFyaXR5XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gY2hhbmdlIGluIHJhcml0eVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHVwZ3JhZGVSYXJpdHk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgc3dpdGNoICh0aGlzLnJhcml0eSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5OT1JNQUw6XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLlNIT1dDQVNFOlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLk1BR0lDOlxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmFyaXR5ID0gSXRlbS5SQVJJVFkuUkFSRTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc3RhdHMgb2YgbW9kcyBjb21iaW5lZFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IHN0YXRfaWQgPT4gdmFsdWVcclxuICAgICAgICAgKi9cclxuICAgICAgICBzdGF0czogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgc3RhdHMgPSB7fTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGZsYXR0ZW4gbW9kcy5zdGF0c0pvaW5lZCgpXHJcbiAgICAgICAgICAgICQuZWFjaCgkLm1hcCh0aGlzLmFzQXJyYXkoKS5jb25jYXQodGhpcy5nZXRJbXBsaWNpdHMoKSksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2Quc3RhdHNKb2luZWQoKTtcclxuICAgICAgICAgICAgfSksIGZ1bmN0aW9uIChfLCBzdGF0KSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgaWQgPSBzdGF0LmdldFByb3AoXCJJZFwiKTtcclxuICAgICAgICAgICAgICAgIC8vIGdyb3VwIGJ5IHN0YXQuSWRcclxuICAgICAgICAgICAgICAgIGlmIChzdGF0c1tpZF0pIHtcclxuICAgICAgICAgICAgICAgICAgICBzdGF0c1tpZF0udmFsdWVzLmFkZChzdGF0LnZhbHVlcyk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHN0YXRzW2lkXSA9IHN0YXQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHN0YXRzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc3RhdHMgZnJvbSB0aGUgaXRlbSB3aXRoIHN0YXRzIGZyb20gbW9kcyBhcHBsaWVkXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gZGVzYyA9PiB2YWx1ZXJhbmdlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbG9jYWxTdGF0czogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgc3RhdHMgPSB0aGlzLnN0YXRzKCk7XHJcbiAgICAgICAgICAgIHZhciBsb2NhbF9zdGF0cyA9IHt9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gVE9ETyBxdWFsaXR5XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodGhpcy5tZXRhX2RhdGEuaXNBKCdBYnN0cmFjdFdlYXBvbicpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBhZGRlZCBmbGF0XHJcbiAgICAgICAgICAgICAgICAkLmVhY2goe1xyXG4gICAgICAgICAgICAgICAgICAgIFwicGh5c2ljYWxcIjogIG5ldyBWYWx1ZVJhbmdlKCt0aGlzLmVudHJ5LmdldFByb3AoXCJEYW1hZ2VNaW5cIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICt0aGlzLmVudHJ5LmdldFByb3AoXCJEYW1hZ2VNYXhcIikpLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiZmlyZVwiOiBuZXcgVmFsdWVSYW5nZSgwLCAwKSxcclxuICAgICAgICAgICAgICAgICAgICBcImNvbGRcIjogbmV3IFZhbHVlUmFuZ2UoMCwgMCksXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsaWdodG5pbmdcIjogbmV3IFZhbHVlUmFuZ2UoMCwgMCksXHJcbiAgICAgICAgICAgICAgICAgICAgXCJjaGFvc1wiOiBuZXcgVmFsdWVSYW5nZSgwLCAwKVxyXG4gICAgICAgICAgICAgICAgfSwgZnVuY3Rpb24gKHNvdXJjZSwgZGFtYWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRzWydsb2NhbF9taW5pbXVtX2FkZGVkXycgKyBzb3VyY2UgKyAnX2RhbWFnZSddKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhbWFnZS5taW4gPSBzdGF0c1snbG9jYWxfbWluaW11bV9hZGRlZF8nICsgc291cmNlICsgJ19kYW1hZ2UnXS52YWx1ZXMuYWRkKGRhbWFnZS5taW4pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gICAgIFxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHNbJ2xvY2FsX21heGltdW1fYWRkZWRfJyArIHNvdXJjZSArICdfZGFtYWdlJ10pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGFtYWdlLm1heCA9IHN0YXRzWydsb2NhbF9tYXhpbXVtX2FkZGVkXycgKyBzb3VyY2UgKyAnX2RhbWFnZSddLnZhbHVlcy5hZGQoZGFtYWdlLm1heCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gVE9ETyBjb21iaW5lIGVsZSBkYW1hZ2VcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWRhbWFnZS5pc1plcm8oKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbF9zdGF0c1tzb3VyY2UudWNmaXJzdCgpICsgJyBEYW1hZ2UnXSA9IGRhbWFnZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gVE9ETyBjb21iaW5lIGVsZVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBhcHBseSBpbmNyZWFzZXNcclxuICAgICAgICAgICAgICAgIGxvY2FsX3N0YXRzWydQaHlzaWNhbCBEYW1hZ2UnXSA9IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBJdGVtLmFwcGx5U3RhdChsb2NhbF9zdGF0c1snUGh5c2ljYWwgRGFtYWdlJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzWydsb2NhbF9waHlzaWNhbF9kYW1hZ2VfKyUnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIENyaXRcclxuICAgICAgICAgICAgICAgIGxvY2FsX3N0YXRzWydDcml0aWNhbCBTdHJpa2UgQ2hhbmNlJ10gPSBcclxuICAgICAgICAgICAgICAgICAgICAgICAgSXRlbS5hcHBseVN0YXQoK3RoaXMuZW50cnkuZ2V0UHJvcCgnQ3JpdGljYWwnKSAvIDEwMCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHNbJ2xvY2FsX2NyaXRpY2FsX3N0cmlrZV9jaGFuY2VfKyUnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMikudG9TdHJpbmcoKSArIFwiJVwiO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIEFQU1xyXG4gICAgICAgICAgICAgICAgbG9jYWxfc3RhdHNbJ0F0dGFja3MgUGVyIFNlY29uZCddID0gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEl0ZW0uYXBwbHlTdGF0KDEwMDAgLyArdGhpcy5lbnRyeS5nZXRQcm9wKFwiU3BlZWRcIiksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzWydsb2NhbF9hdHRhY2tfc3BlZWRfKyUnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMik7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy5tZXRhX2RhdGEuaXNBKCdBYnN0cmFjdEFybW91cicpKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgICAgICAvLyBkZWZlbmNlc1xyXG4gICAgICAgICAgICAgICAgJC5lYWNoKHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBDb21wb25lbnRBcm1vdXIgPT4gc3RhdF9uYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgQXJtb3VyOiBcInBoeXNpY2FsX2RhbWFnZV9yZWR1Y3Rpb25cIixcclxuICAgICAgICAgICAgICAgICAgICBFdmFzaW9uOiBcImV2YXNpb25cIixcclxuICAgICAgICAgICAgICAgICAgICBFbmVyZ3lTaGllbGQ6IFwiZW5lcmd5X3NoaWVsZFwiXHJcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoY29tcG9uZW50LCBzdGF0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5pdGFsIHZhbHVlXHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxfc3RhdHNbY29tcG9uZW50XSA9IG5ldyBWYWx1ZVJhbmdlKCt0aGF0LmVudHJ5LmdldFByb3AoY29tcG9uZW50KSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgK3RoYXQuZW50cnkuZ2V0UHJvcChjb21wb25lbnQpKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAvLyBhZGRlZCBmbGF0XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXRzWydsb2NhbF9iYXNlXycgKyBzdGF0ICsgJ19yYXRpbmcnXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsb2NhbF9zdGF0c1tjb21wb25lbnRdID0gbG9jYWxfc3RhdHNbY29tcG9uZW50XS5hZGQoc3RhdHNbJ2xvY2FsX2Jhc2VfJyArIHN0YXQgKyAnX3JhdGluZyddLnZhbHVlcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIGluY3JlYXNlXHJcbiAgICAgICAgICAgICAgICAgICAgbG9jYWxfc3RhdHNbY29tcG9uZW50XSA9IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgSXRlbS5hcHBseVN0YXQobG9jYWxfc3RhdHNbY29tcG9uZW50XSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRzWydsb2NhbF8nICsgc3RhdCArICdfcmF0aW5nXyslJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwKTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZiAobG9jYWxfc3RhdHNbY29tcG9uZW50XS5pc1plcm8oKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgbG9jYWxfc3RhdHNbY29tcG9uZW50XTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gVE9ETyBjb2xvciBzdGF0c1xyXG4gICAgICAgICAgICByZXR1cm4gbG9jYWxfc3RhdHM7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogdGFrZXMgYSBpbmNyZWFzZWQgc3RhdCBhbmQgYXBwbGllcyBpdCB0byB0aGUgdmFsdWVcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtWYWx1ZVJhbmdlfE51bWJlcn0gdmFsdWVcclxuICAgICAqIEBwYXJhbSB7U3RhdH0gc3RhdFxyXG4gICAgICogQHBhcmFtIHtOdW1iZXJ9IHByZWNpc2lvblxyXG4gICAgICogQHJldHVybnMge1ZhbHVlUmFuZ2V9XHJcbiAgICAgKi9cclxuICAgIEl0ZW0uYXBwbHlTdGF0ID0gZnVuY3Rpb24gKHZhbHVlLCBzdGF0LCBwcmVjaXNpb24pIHtcclxuICAgICAgICB2YXIgcmVzdWx0ID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoc3RhdCA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gMTAwJSBpbmNyZWFzZWQgOj0gMiA9ICgxMDAlIC8gMTAwKSArIDFcclxuICAgICAgICAgICAgdmFyIG11bHRpcGxpZXIgPSBzdGF0LnZhbHVlcy5tdWx0aXBseSgxIC8gMTAwKS5hZGQoMSk7XHJcblxyXG5cclxuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVmFsdWVSYW5nZSkge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gdmFsdWUubXVsdGlwbHkobXVsdGlwbGllcik7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBtdWx0aXBsaWVyLm11bHRpcGx5KHZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcmVzdWx0LnRvRml4ZWQocHJlY2lzaW9uKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogbWV0YSBkYXRhIG9iamVjdCB1bmluaXRpYWxpemVkXHJcbiAgICAgKi9cclxuICAgIEl0ZW0ubWV0YV9kYXRhID0gbnVsbDtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBhbGwgcG9zc2libGUgcmFyaXRpZXNcclxuICAgICAqL1xyXG4gICAgSXRlbS5SQVJJVFkgPSB7XHJcbiAgICAgICAgTk9STUFMOiAxLFxyXG4gICAgICAgIE1BR0lDOiAyLFxyXG4gICAgICAgIFJBUkU6IDMsXHJcbiAgICAgICAgVU5JUVVFOiA0LFxyXG4gICAgICAgIFNIT1dDQVNFOiA1XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIG1heGltdW0gaXRlbSBsZXZlbFxyXG4gICAgICovXHJcbiAgICBJdGVtLk1BWF9JTFZMID0gMTAwO1xyXG4gICAgXHJcbiAgICAvKiB0YWdzIGFyZSBvYnNvbHRlLiB0aGV5IGFyZSBkZXJpdmF0ZWQgZnJvbSB0aGUgaW5oZXJpdGFuY2UgY2hhaW5cclxuICAgICAqIHRoZXkgYXJlIGtlcHQgZm9yIGhpc3RvcmljIHJlYXNvbnMgKi9cclxuICAgIEl0ZW0uSVRFTUNMQVNTRVMgPSB7XHJcbiAgICAgICAgQU1VTEVUOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDUsIFxyXG4gICAgICAgICAgICAvLyBhbXVsZXQsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzMsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBSSU5HOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDYsIFxyXG4gICAgICAgICAgICAvLyByaW5nLCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFsyLCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQ0xBVzoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiA3LCBcclxuICAgICAgICAgICAgLy8gY2xhdywgb25laGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxNCwgODEsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBEQUdHRVI6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDgsIFxyXG4gICAgICAgICAgICAvLyBkYWdnZXIsIG9uZWhhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTMsIDgxLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgV0FORDogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogOSwgXHJcbiAgICAgICAgICAgIC8vIHdhbmQsIG9uZWhhbmR3ZWFwb24sIHdlYXBvbiwgcmFuZ2VkXHJcbiAgICAgICAgICAgIFRBR1M6IFs5LCA4MSwgOCwgMzJdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTV09SRF8xSDogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogMTAsIFxyXG4gICAgICAgICAgICAvLyBzd29yZCwgb25laGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxMiwgODEsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBUSFJVU1RJTkdfU1dPUkRfMUg6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMTEsIFxyXG4gICAgICAgICAgICAvLyBzd29yZCwgb25laGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxMiwgODEsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBBWEVfMUg6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMTIsIFxyXG4gICAgICAgICAgICAvLyBheGUsIG9uZWhhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTUsIDgxLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgTUFDRV8xSDogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogMTMsIFxyXG4gICAgICAgICAgICAvLyBtYWNlLCBvbmVoYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzExLCA4MSwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEJPVzoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAxNCxcclxuICAgICAgICAgICAgLy8gYm93LCB0d29oYW5kd2VhcG9uLCB3ZWFwb24sIHJhbmdlZFxyXG4gICAgICAgICAgICBUQUdTOiBbNSwgODIsIDgsIDMyXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgU1RBRkY6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDE1LCBcclxuICAgICAgICAgICAgLy8gU3RhZmYsIHR3b2hhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTAsIDgyLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgU1dPUkRfMkg6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDE2LCBcclxuICAgICAgICAgICAgLy8gc3dvcmQsIHR3b2hhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTIsIDgyLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQVhFXzJIOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiAxNywgXHJcbiAgICAgICAgICAgIC8vIGF4ZSwgdHdvaGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxNSwgODIsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBNQUNFXzJIOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDE4LCBcclxuICAgICAgICAgICAgLy8gbWFjZSwgdHdvaGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxMSwgODIsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBRVUlWRVI6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMjEsIFxyXG4gICAgICAgICAgICAvLyBxdWl2ZXIsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzIxLCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQkVMVDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAyMiwgXHJcbiAgICAgICAgICAgIC8vIGJlbHQsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzI2LCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgR0xPVkVTOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDIzLCBcclxuICAgICAgICAgICAgLy8gZ2xvdmVzLCBhcm1vdXIsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzIyLCA3LCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQk9PVFM6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMjQsIFxyXG4gICAgICAgICAgICAvLyBib290cywgYXJtb3VyLCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFs0LCA3LCAwXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQVJNT1VSOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDI1LCBcclxuICAgICAgICAgICAgLy8gYm9keV9hcm1vdXIsIGFybW91ciwgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMTYsIDcsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBIRUxNRVQ6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMjYsIFxyXG4gICAgICAgICAgICAvLyBoZWxtZXQsIGFybW91ciwgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMjUsIDcsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTSElFTEQ6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDI3LCBcclxuICAgICAgICAgICAgLy8gc2hpZWxkLCBhcm1vdXIsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzEsIDcsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTQ0VQVFJFOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDMzLCBcclxuICAgICAgICAgICAgLy8gc2NlcHRyZSwgb25laGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFszNywgODEsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBNQVA6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMzYsIFxyXG4gICAgICAgICAgICAvLyBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFswXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgRklTSElOR19ST0Q6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMzgsIFxyXG4gICAgICAgICAgICAvLyBmaXNoaW5nX3JvZFxyXG4gICAgICAgICAgICBUQUdTOiBbODBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBNQVBfRlJBR01FTlQ6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDM5LFxyXG4gICAgICAgICAgICBUQUdTOiBbXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgSkVXRUw6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogNDIsIFxyXG4gICAgICAgICAgICAvLyBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFswXVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gSXRlbTtcclxufSkuY2FsbCh0aGlzKTtcclxuXHJcbiIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBNb2RDb250YWluZXIgPSByZXF1aXJlKFwiLi9Nb2RDb250YWluZXJcIik7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBJdGVtSW1wbGljaXRzIGV4dGVuZHMgTW9kQ29udGFpbmVyXHJcbiAgICAgKiBcclxuICAgICAqIGhvbGRzIGFsbCBpbXBsaWNpdHMgZm9yIGl0ZW1zXHJcbiAgICAgKi9cclxuICAgIHZhciBJdGVtSW1wbGljaXRzID0gTW9kQ29udGFpbmVyLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2R9IG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIHN1Y2Nlc3NcclxuICAgICAgICAgKi9cclxuICAgICAgICBhZGRNb2Q6IGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgaWYgKCEobW9kIGluc3RhbmNlb2YgTW9kKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNSb29tRm9yKG1vZCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zdXBlcihtb2QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kfSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfSAtMSBpZiBub3QgcG9zc2libGUgYXQgYWxsXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWF4TW9kc09mVHlwZTogZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBpZiAgKCttb2QuZ2V0UHJvcChcIkdlbmVyYXRpb25UeXBlXCIpID09PSBNb2QuTU9EX1RZUEUuUFJFTUFERSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIDU7XHJcbiAgICAgICAgICAgIH0gXHJcbiAgICAgICAgICAgIHJldHVybiAtMTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBJdGVtSW1wbGljaXRzO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgICd1c2Ugc3RyaWN0JztcclxuICAgIFxyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZShcIi4uL0luaGVyaXRhbmNlXCIpO1xyXG4gICAgdmFyIE1vZCA9IHJlcXVpcmUoXCIuLi9tb2RzL01vZFwiKTtcclxuICAgIFxyXG4gICAgaWYgKCQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLypcclxuICAgICAqIE1vZENvbnRhaW5lciBjbGFzc1xyXG4gICAgICogXHJcbiAgICAgKiBDb250YWluZXIgZm9yIEBsaW5rIE1vZFxyXG4gICAgICovXHJcbiAgICB2YXIgTW9kQ29udGFpbmVyID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBtb2RzIGFsbCBtb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge01vZENvbnRhaW5lcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAobW9kcykge1xyXG4gICAgICAgICAgICBpZiAobW9kcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kcyA9IFtdO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RzID0gbW9kcztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICogQHZhciB0aGlzLm1vZHMgQXJyYXk8TW9kPlxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMudGFncyA9IFtdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyBhIG5ldyBub24tZXhpc3RpbmcgbW9kXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2R9IG5ld19tb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBvbiBzdWNjZXNzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYWRkTW9kOiBmdW5jdGlvbiAobmV3X21vZCkge1xyXG4gICAgICAgICAgICBpZiAoIShuZXdfbW9kIGluc3RhbmNlb2YgTW9kKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignbW9kIG11c3QgYmUgaW5zdGFuY2Ugb2YgYE1vZGAnKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodGhpcy5pbk1vZHMobmV3X21vZC5nZXRQcm9wKFwiUm93c1wiKSkgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZHMucHVzaChuZXdfbW9kKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHRydW5jYXRlcyBtb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmVtb3ZlQWxsTW9kczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLm1vZHMgPSBbXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHJlbW92ZXMgYW4gZXhpc3RpbmcgbW9kXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBvbGRfbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcnxCb29sZWFufSBmYWxzZSBpZiBub24tZXhpc3RpbmdcclxuICAgICAgICAgKi9cclxuICAgICAgICByZW1vdmVNb2Q6IGZ1bmN0aW9uIChvbGRfbW9kKSB7ICBcclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy5pbk1vZHMob2xkX21vZC5nZXRQcm9wKFwiUm93c1wiKSk7XHJcbiAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kcy5zcGxpY2UoaW5kZXgsIDEpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGluZGV4O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdldHMgYSBtb2QgYnkgcHJpbWFyeVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gcHJpbWFyeVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2R9IG51bGwgaWYgbm90IGV4aXN0aW5nXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0TW9kOiBmdW5jdGlvbiAocHJpbWFyeSkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSB0aGlzLmluTW9kcyhwcmltYXJ5KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1vZHNbaW5kZXhdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY2hlY2tzIGlmIGEgbW9kIGlzIGluIHRoZSBjb250YWluZXJcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gcHJpbWFyeSBwcmltYXJ5IG9mIHRoZSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfSBpbmRleCBvZiB0aGUgbW9kc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluTW9kczogZnVuY3Rpb24gKHByaW1hcnkpIHtcclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gLTE7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkLmVhY2godGhpcy5tb2RzLCBmdW5jdGlvbiAoaSwgbW9kKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoK21vZC5nZXRQcm9wKFwiUm93c1wiKSA9PT0gK3ByaW1hcnkpIHtcclxuICAgICAgICAgICAgICAgICAgICBpbmRleCA9IGk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBpbmRleDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHJldHVybnMgdGFncyBvZiB0aGUgbW9kcyBpbiB0aGUgY29udGFpbmVyXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldFRhZ3M6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgLy8galF1ZXJ5IG1hcCBhbHJlYWR5IGZsYXR0ZW5zXHJcbiAgICAgICAgICAgIHJldHVybiAkLnVuaXF1ZSgkLm1hcCh0aGlzLm1vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2QudmFsdWVBc0FycmF5KFwiVGFnc0tleXNcIik7XHJcbiAgICAgICAgICAgIH0pKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGludGVyc2VjdHMgYWxsIHRhZ3Mgd2l0aCB0aGUgb25lcyBvbiB0aGUgaXRlbVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF90YWdzXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fSB0YWdzIGZyb20gdGhlIGl0ZW0gd2l0aCB0aGVpciBwcm9wZXJ0aWVzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0VGFnc1dpdGhQcm9wczogZnVuY3Rpb24gKGFsbF90YWdzKSB7XHJcbiAgICAgICAgICAgIHZhciB0YWdzID0gdGhpcy5nZXRUYWdzKCk7XHJcbiAgICAgICAgICAgIHJldHVybiAkLmdyZXAoYWxsX3RhZ3MsIGZ1bmN0aW9uICh0YWdfcHJvcHMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0YWdzLmluZGV4T2YoK3RhZ19wcm9wcy5Sb3dzKSAhPT0gLTE7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWxsIHByZWZpeCBtb2RzXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldFByZWZpeGVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAkLmdyZXAodGhpcy5tb2RzLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLmlzUHJlZml4KCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWxsIHN1ZmZpeCBtb2RzXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldFN1ZmZpeGVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAkLmdyZXAodGhpcy5tb2RzLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLmlzU3VmZml4KCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc3VmZml4ZXMgYW5kIHByZWZpeGVzXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldEFmZml4ZXM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgLy8gcmF0aGVyIG9yZGVyIHRoZSBtb2RzIHRoYW4gbWl4IGVtIHVwXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldFByZWZpeGVzKCkuY29uY2F0KHRoaXMuZ2V0U3VmZml4ZXMoKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhbGwgbW9kcyBcclxuICAgICAgICAgKi9cclxuICAgICAgICBhc0FycmF5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gbW9kX3R5cGUgc2VhcmNoZWQgR2VuZXJhdGlvblR5cGVcclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG51bWJlck9mTW9kc09mVHlwZTogZnVuY3Rpb24gKG1vZF90eXBlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAkLmdyZXAodGhpcy5tb2RzLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gK21vZC5nZXRQcm9wKFwiR2VuZXJhdGlvblR5cGVcIikgPT09IG1vZF90eXBlO1xyXG4gICAgICAgICAgICB9KS5sZW5ndGg7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBjaGVja3MgaWYgdGhlcmVzIG1vcmUgcGxhY2UgZm9yIGEgbW9kIHdpdGggdGhlaXIgZ2VuZXJhdGlvbnR5cGVcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge01vZH0gbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgcm9vbSBmb3JcclxuICAgICAgICAgKi9cclxuICAgICAgICBoYXNSb29tRm9yOiBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm51bWJlck9mTW9kc09mVHlwZSgrbW9kLmdldFByb3AoXCJHZW5lcmF0aW9uVHlwZVwiKSkgPCB0aGlzLm1heE1vZHNPZlR5cGUobW9kKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBhYnN0cmFjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXhNb2RzT2ZUeXBlOiBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwib3ZlcnJpZGUgYWJzdHJhY3QgbWF4TW9kc09mVHlwZVwiKTtcclxuICAgICAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyBcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNb2RDb250YWluZXI7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6IGZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgVHJhbnNtdXRlID0gcmVxdWlyZSgnLi9UcmFuc211dGUnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIFxyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEFsY2hlbXkgZXh0ZW5kcyBDdXJyZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiBpbmdhbWUgcmVwcmVzZW50YXRpb24gb2YgT3JiIG9mIEFsY2hlbXlcclxuICAgICAqIG1vZCBnZW5lcmF0aW9uIG1vc3QgbGlrZWx5IG5vdCBhY2N1cmF0ZSBiZWNhdXNlIHdlIGp1c3Qgcm9sbCA0LTYgbW9kc1xyXG4gICAgICogYW5kIGNvcnJlbGF0ZSAjcHJlZml4cy9zdWZmaXhlcyB0byBlYWNoZSBvdGhlciBpZiB0aGUgcmF0aW8gPj0gMzoxXHJcbiAgICAgKi9cclxuICAgIHZhciBBbGNoZW15ID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge0FsY2hlbXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBUcmFuc211dGUubW9kX2ZpbHRlcik7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIkFsY2hlbXlcIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgNC02XHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgICAgICAgdmFyIGk7XHJcbiAgICAgICAgICAgIHZhciBuZXdfbW9kcztcclxuICAgICAgICAgICAgdmFyIHByZWZpeGVzLCBzdWZmaXhlcztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gdXBncmFkZSB0byByYXJlXHJcbiAgICAgICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcblxyXG4gICAgICAgICAgICAgICAgZm9yIChpID0gMSwgbmV3X21vZHMgPSBNYXRoLnJhbmQoNCwgNik7IGkgPD0gbmV3X21vZHM7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uYWRkTW9kKHRoaXMuY2hvb3NlTW9kKGl0ZW0pKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcHJlZml4ZXMgPSBpdGVtLmdldFByZWZpeGVzKCkubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgc3VmZml4ZXMgPSBpdGVtLmdldFN1ZmZpeGVzKCkubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBjb3JyZWN0IGRpZmZlcmVuY2VzIGJldHdlZW4gI3ByZWZpeGVzLCAjc3VmZml4ZXMgPj0gMlxyXG4gICAgICAgICAgICAgICAgZm9yIChpID0gMSwgbmV3X21vZHMgPSBNYXRoLm1heCgwLCBNYXRoLmFicyhwcmVmaXhlcyAtIHN1ZmZpeGVzKSAtIDEpOyBpIDw9IG5ld19tb2RzOyArK2kpIHtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtLmFkZE1vZCh0aGlzLmNob29zZU1vZChpdGVtKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBtYXBzIG1vZDo6YXBwbGljYWJsZVRvIGFzIGlmIGl0IHdlcmUgYWxyZWFkeSBtYWdpY1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSB1cGdyYWRlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuUkFSRTtcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSB0aGlzLl9zdXBlcihpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBncmVwcyBtb2Q6OmFwcGxpY2FibGVUbyBhcyBpZiBpdCB3ZXJlIGFscmVhZHkgcmFyZVxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gc3VjY2Vzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtb2RzOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSB1cGdyYWRlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuUkFSRTtcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSB0aGlzLl9zdXBlcihpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIFNVQ0NFU1MgYnl0ZVxyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSAmPSB+QXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChiYXNlaXRlbS5yYXJpdHkgIT09IEl0ZW0uUkFSSVRZLk5PUk1BTCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQWxjaGVteS5BUFBMSUNBQkxFX0JZVEUuTk9UX1dISVRFO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKlxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCeXRlU2V0Lmh1bWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbGNoZW15LkFQUExJQ0FCTEVfQllURSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsY2hlbXkuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkFsY2hlbXkuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJPcmIgb2YgQWxjaGVteVwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBBbGNoZW15LkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBDdXJyZW5jeVxyXG4gICAgICAgIFVOU0NBTk5FRDogMCxcclxuICAgICAgICBTVUNDRVNTOiAxLFxyXG4gICAgICAgIE5PVF9BTl9JVEVNOiAyLFxyXG4gICAgICAgIC8vIGV4dGVuZGVkXHJcbiAgICAgICAgTk9UX1dISVRFOiA0XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEFsY2hlbXk7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDdXJyZW5jeSA9IHJlcXVpcmUoJy4vQ3VycmVuY3knKTtcclxuICAgIHZhciBUcmFuc211dGUgPSByZXF1aXJlKCcuL1RyYW5zbXV0ZScpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgQXVnbWVudCBleHRlbmRzIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIHJlcHJlc2FudGF0aW9uIG9mIE9yYiBvZiBBdWdtZW50YXRpb25cclxuICAgICAqL1xyXG4gICAgdmFyIEFsdGVyYXRpb24gPSBDdXJyZW5jeS5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge0FsdGVyYXRpb259XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBUcmFuc211dGUubW9kX2ZpbHRlcik7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIkFsdGVyYXRpb25cIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgb25lIHJhbmRvbSBwcm9wZXJ0eVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBAbGluayBJdGVtOjphZGRNb2RcclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoaXRlbSkgeyBcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPIGFjdHVhbGx5IGNvbnNpZGVycyAqX2Nhbm5vdF9iZV9jaGFuZ2VkP1xyXG4gICAgICAgICAgICAgICAgLy8gZ3JhbnRlZCB2aWEgc2NvdXJpbmcgYnV0IGlzIHRoaXMgdHJ1ZSBmb3IgaW5nYW1lIGFsdHM/XHJcbiAgICAgICAgICAgICAgICBuZXcgU2NvdXJpbmcoKS5hcHBseVRvKGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgLy8gbm8gY29tcGxldGUgc2NvdXI/XHJcbiAgICAgICAgICAgICAgICBpZiAoIShuZXcgVHJhbnNtdXRlKHRoaXMuYXZhaWxhYmxlX21vZHMpLmFwcGx5VG8oaXRlbSkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3IEF1Z21lbnQodGhpcy5hdmFpbGFibGVfbW9kcykuYXBwbHlUbyhpdGVtKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGl0ZW0gbmVlZHMgdG8gYmUgbWFnaWNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtCeXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIFNVQ0NFU1MgYnl0ZVxyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSAmPSB+QXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChiYXNlaXRlbS5yYXJpdHkgIT09IEl0ZW0uUkFSSVRZLk1BR0lDKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBbHRlcmF0aW9uLkFQUExJQ0FCTEVfQllURS5OT1RfTUFHSUM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5hcHBsaWNhYmxlX2J5dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBbHRlcmF0aW9uLkFQUExJQ0FCTEVfQllURSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsdGVyYXRpb24uQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkFsdGVyYXRpb24uYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJPcmIgb2YgQWx0ZXJhdGlvblwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBBbHRlcmF0aW9uLkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBDdXJyZW5jeVxyXG4gICAgICAgIFVOU0NBTk5FRDogMCxcclxuICAgICAgICBTVUNDRVNTOiAxLFxyXG4gICAgICAgIE5PVF9BTl9JVEVNOiAyLFxyXG4gICAgICAgIC8vIGV4dGVuZGVkXHJcbiAgICAgICAgTk9UX01BR0lDOiA0XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEFsdGVyYXRpb247XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDdXJyZW5jeSA9IHJlcXVpcmUoJy4vQ3VycmVuY3knKTtcclxuICAgIHZhciBUcmFuc211dGUgPSByZXF1aXJlKCcuL1RyYW5zbXV0ZScpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEF1Z21lbnQgZXh0ZW5kcyBDdXJyZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiByZXByZXNhbnRhdGlvbiBvZiBPcmIgb2YgQXVnbWVudGF0aW9uXHJcbiAgICAgKi9cclxuICAgIHZhciBBdWdtZW50ID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBdWdtZW50fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChhbGxfbW9kcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihhbGxfbW9kcywgVHJhbnNtdXRlLm1vZF9maWx0ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLmtsYXNzID0gXCJBdWdtZW50XCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIG9uZSByYW5kb20gcHJvcGVydHlcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gQGxpbmsgSXRlbTo6YWRkTW9kXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHsgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0uYWRkTW9kKHRoaXMuY2hvb3NlTW9kKGl0ZW0pKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogaXRlbSBuZWVkcyB0byBiZSBtYWdpY1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge0J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgU1VDQ0VTUyBieXRlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlICY9IH5BcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtLnJhcml0eSAhPT0gSXRlbS5SQVJJVFkuTUFHSUMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IEF1Z21lbnQuQVBQTElDQUJMRV9CWVRFLk5PVF9NQUdJQztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEF1Z21lbnQuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQXVnbWVudC5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiQXVnbWVudC5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIk9yYiBvZiBBdWdtZW50YXRpb25cIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgQXVnbWVudC5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgLy8gQ3VycmVuY3lcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsXHJcbiAgICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgICBOT1RfQU5fSVRFTTogMixcclxuICAgICAgICAvLyBleHRlbmRlZFxyXG4gICAgICAgIE5PVF9NQUdJQzogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBBdWdtZW50O1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgVHJhbnNtdXRlID0gcmVxdWlyZSgnLi9UcmFuc211dGUnKTtcclxuICAgIHZhciBBbGNoZW15ID0gcmVxdWlyZSgnLi9BbGNoZW15Jyk7XHJcbiAgICB2YXIgU2NvdXJpbmcgPSByZXF1aXJlKCcuL1Njb3VyaW5nJyk7XHJcbiAgICB2YXIgRXhhbHRlZCA9IHJlcXVpcmUoJy4vRXhhbHRlZCcpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgQ2hhb3MgZXh0ZW5kcyBDdXJyZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiByZXByZXNhbnRhdGlvbiBvZiBDaGFvcyBPcmJcclxuICAgICAqL1xyXG4gICAgdmFyIENoYW9zID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtDaGFvc31cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiQ2hhb3NcIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgb25lIHJhbmRvbSBwcm9wZXJ0eVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBAbGluayBJdGVtOjphZGRNb2RcclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoaXRlbSkgeyBcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPIGFjdHVhbGx5IGNvbnNpZGVycyAqX2Nhbm5vdF9iZV9jaGFuZ2VkP1xyXG4gICAgICAgICAgICAgICAgLy8gZ3JhbnRlZCB2aWEgc2NvdXJpbmcgYnV0IGlzIHRoaXMgdHJ1ZSBmb3IgaW5nYW1lIGFsdHM/XHJcbiAgICAgICAgICAgICAgICBuZXcgU2NvdXJpbmcoKS5hcHBseVRvKGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgLy8gbm8gY29tcGxldGUgc2NvdXI/XHJcbiAgICAgICAgICAgICAgICBpZiAoIShuZXcgQWxjaGVteSh0aGlzLmF2YWlsYWJsZV9tb2RzKS5hcHBseVRvKGl0ZW0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE8gY29ycmVsYXRlIGNvdW50XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3IEV4YWx0ZWQodGhpcy5hdmFpbGFibGVfbW9kcykuYXBwbHlUbyhpdGVtKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGl0ZW0gbmVlZHMgdG8gYmUgcmFyZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge0J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgU1VDQ0VTUyBieXRlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlICY9IH5BcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtLnJhcml0eSAhPT0gSXRlbS5SQVJJVFkuUkFSRSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQ2hhb3MuQVBQTElDQUJMRV9CWVRFLk5PVF9SQVJFO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2hhb3MuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2hhb3MuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNoYW9zLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiQ2hhb3MgT3JiXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIENoYW9zLkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBDdXJyZW5jeVxyXG4gICAgICAgIFVOU0NBTk5FRDogMCxcclxuICAgICAgICBTVUNDRVNTOiAxLFxyXG4gICAgICAgIE5PVF9BTl9JVEVNOiAyLFxyXG4gICAgICAgIC8vIGV4dGVuZGVkXHJcbiAgICAgICAgTk9UX1JBUkU6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gQ2hhb3M7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBNb2RHZW5lcmF0b3IgPSByZXF1aXJlKCcuL01vZEdlbmVyYXRvcicpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICB2YXIgUm9sbGFibGVNb2QgPSByZXF1aXJlKCcuLi9tb2RzL1JvbGxhYmxlTW9kJyk7XHJcbiAgICB2YXIgSXRlbSA9IHJlcXVpcmUoJy4uL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgXHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogYWJzdHJhY3QgY2xhc3MgQ3VycmVuY3kgZXh0ZW5kcyBNb2RHZW5lcmF0b3JcclxuICAgICAqIFxyXG4gICAgICogYWJzdHJhY3QgcmVwcmVzZW50YXRpb24gb2YgaW5nYW1lIGN1cnJlbmN5IHdoaWNoIG9ubHkgYWNjZXB0c1xyXG4gICAgICogcHJlZml4ZXMsIHN1ZmZpeGVzIGFuZCBpbXBsaWNpdHNcclxuICAgICAqL1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gTW9kR2VuZXJhdG9yLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBhbmRfZmlsdGVyIGFkZGl0aW9uYWwgZmlsdGVyIGZ1bmN0aW9uIGZvciAkLm1hcFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2RHZW5lcmF0b3J9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzLCBhbmRfZmlsdGVyKSB7XHJcbiAgICAgICAgICAgIGlmIChhbmRfZmlsdGVyID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgLy8gZHVtbXkgZmlsdGVyXHJcbiAgICAgICAgICAgICAgICBhbmRfZmlsdGVyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdHJ1ZTsgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFJvbGxhYmxlTW9kLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLlNwYXduV2VpZ2h0X1RhZ3NLZXlzICE9PSBcIlwiICYmIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmRfZmlsdGVyKG1vZCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGFic3RyYWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtNb2RDb250YWluZXJ9IG1vZF9jb250YWluZXJcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBtYXBzIE1vZDo6YXBwbGljYWJsZVRvIGFuZCBNb2Q6OnNwYXduYWJsZU9uIHRvIGFsbCBhdmFpbGFibGUgbW9kc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICByZXR1cm4gJC5tYXAodGhpcy5nZXRBdmFpbGFibGVNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIG1vZC5hcHBsaWNhYmxlVG8oaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgICAgICBtb2Quc3Bhd25hYmxlT24oaXRlbSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2Q7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ3JlcHMgTW9kOjphcHBsaWNhYmxlVG8gYW5kIE1vZDo6c3Bhd25hYmxlT24gdG8gYWxsIGF2YWlsYWJsZSBtb2RzXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAkLmdyZXAodGhpcy5nZXRBdmFpbGFibGVNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2QuYXBwbGljYWJsZVRvKGl0ZW0sIHN1Y2Nlc3MpICYmIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2Quc3Bhd25hYmxlT24oaXRlbSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY3VycmVuY3kgb25seSBhcHBsaWVzIHRvIGl0ZW1zXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2RDb250YWluZXJ9IG1vZF9jb250YWluZXJcclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lciwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0QXBwbGljYWJsZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghKG1vZF9jb250YWluZXIgaW5zdGFuY2VvZiBJdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQ3VycmVuY3kuQVBQTElDQUJMRV9CWVRFLk5PVF9BTl9JVEVNO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzZXRzIHRoZSBjbGFzcyBiYWNrIHRvIHVuc2Nhbm5lZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlc2V0QXBwbGljYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBDdXJyZW5jeS5BUFBMSUNBQkxFX0JZVEUsIEN1cnJlbmN5LkFQUExJQ0FCTEVfQllURS5TVUNDRVNTKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUNhY2hlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBBcHBsaWNhYmxlLlNVQ0NFU1MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJBYnN0cmFjdEN1cnJlbmN5XCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEN1cnJlbmN5LkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBDb252ZW50aW9uIG9mIEFwcGxpY2FibGVcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsXHJcbiAgICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgICAvLyBDdXJyZW5jeVxyXG4gICAgICAgIE5PVF9BTl9JVEVNOiAyXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEN1cnJlbmN5O1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcbiAgICB2YXIgTW9kR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9Nb2RHZW5lcmF0b3InKTtcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcbiAgICB2YXIgUm9sbGFibGVNb2QgPSByZXF1aXJlKCcuLi9tb2RzL1JvbGxhYmxlTW9kJyk7XG4gICAgXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBjbGFzcyBFbmNoYW50bWVudEJlbmNoIGV4dGVuZHMgTW9kR2VuZXJhdG9yXG4gICAgICogXG4gICAgICogaW5nYW1lIHJlcHJlc2VudGF0aW9uIG9mIGEgZW5jaGFudG1lbnQgYmVuY2hcbiAgICAgKi9cbiAgICB2YXIgRW5jaGFudG1lbnRiZW5jaCA9IE1vZEdlbmVyYXRvci5leHRlbmQoe1xuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMsIGFuZF9maWx0ZXIpIHtcbiAgICAgICAgICAgIGlmIChhbmRfZmlsdGVyID09PSBfX3VuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIC8vIGR1bW15IGZpbHRlclxuICAgICAgICAgICAgICAgIGFuZF9maWx0ZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0cnVlOyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihhbGxfbW9kcywgUm9sbGFibGVNb2QsIGZ1bmN0aW9uIChtb2QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLlNwYXduV2VpZ2h0X1RhZ3NLZXlzICE9PSBcIlwiICYmIFxuICAgICAgICAgICAgICAgICAgICAgICAgRW5jaGFudG1lbnRiZW5jaC5tb2RfZmlsdGVyKG1vZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIGV2ZXJ5IGl0ZW0gaXMgd2VsY29tZVxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdHJpbmdzOiBbXSxcbiAgICAgICAgICAgICAgICBiaXRzOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdFbmNoYW50bWVudGJlbmNoJztcbiAgICAgICAgfSxcbiAgICAgICAgbW9kczogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XG4gICAgICAgICAgICByZXR1cm4gJC5ncmVwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0sIHN1Y2Nlc3MpICYmIFxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKGJhc2VpdGVtKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBtYXA6IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xuICAgICAgICAgICAgcmV0dXJuICQubWFwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XG4gICAgICAgICAgICAgICAgbW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSwgc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKGJhc2VpdGVtKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICBFbmNoYW50bWVudGJlbmNoLm1vZF9maWx0ZXIgPSBmdW5jdGlvbiAobW9kX3Byb3BzKSB7XG4gICAgICAgIC8vIHRhbGlzbWFuIHdpbGRjYXJkXG4gICAgICAgIHJldHVybiBbTW9kLk1PRF9UWVBFLkVOQ0hBTlRNRU5UXS5pbmRleE9mKCttb2RfcHJvcHMuR2VuZXJhdGlvblR5cGUpICE9PSAtMTtcbiAgICB9O1xuICAgIFxuICAgIG1vZHVsZS5leHBvcnRzID0gRW5jaGFudG1lbnRiZW5jaDtcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDdXJyZW5jeSA9IHJlcXVpcmUoJy4vQ3VycmVuY3knKTtcclxuICAgIHZhciBUcmFuc211dGUgPSByZXF1aXJlKCcuL1RyYW5zbXV0ZScpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgRXhhbHRlZCBleHRlbmRzIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBFeGFsdGVkIG9yYlxyXG4gICAgICovXHJcbiAgICB2YXIgRXhhbHRlZCA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7RXhhbHRlZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiRXhhbHRlZFwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyBvbmUgcmFuZG9tIHByb3BlcnR5IHRvIGFuIGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoaXRlbSkgeyBcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG9ubHkgYXBwbGljYWJsZSB0byByYXJlIGl0ZW1zXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW0ucmFyaXR5ICE9PSBJdGVtLlJBUklUWS5SQVJFKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBFeGFsdGVkLkFQUExJQ0FCTEVfQllURS5OT1RfUkFSRTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEV4YWx0ZWQuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRXhhbHRlZC5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiRXhhbHRlZC5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIkV4YWx0ZWQgT3JiXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEV4YWx0ZWQuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfUkFSRTogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBFeGFsdGVkO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBNb2RHZW5lcmF0b3IgPSByZXF1aXJlKCcuL01vZEdlbmVyYXRvcicpO1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IHJlcXVpcmUoJy4vVHJhbnNtdXRlJyk7XHJcbiAgICB2YXIgVmFhbCA9IHJlcXVpcmUoJy4vVmFhbCcpO1xyXG4gICAgdmFyIFRhbGlzbWFuID0gcmVxdWlyZSgnLi9UYWxpc21hbicpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01vZCcpO1xyXG4gICAgdmFyIEFwcGxpY2FibGVNb2QgPSByZXF1aXJlKCcuLi9tb2RzL0FwcGxpY2FibGVNb2QnKTtcclxuICAgIHZhciBSb2xsYWJsZU1vZCA9IHJlcXVpcmUoJy4uL21vZHMvUm9sbGFibGVNb2QnKTtcclxuICAgIHZhciBNYXN0ZXJNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01hc3Rlck1vZCcpO1xyXG4gICAgdmFyIFNwYXduYWJsZSA9IHJlcXVpcmUoJy4uL1NwYXduYWJsZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEl0ZW1TaG93Y2FzZSBleHRlbmRzIE1vZEdlbmVyYXRvclxyXG4gICAgICogXHJcbiAgICAgKiBNYXN0ZXJiZW5jaC9DdXJyZW5jeSBoeWJyaWRcclxuICAgICAqL1xyXG4gICAgdmFyIEl0ZW1TaG93Y2FzZSA9IE1vZEdlbmVyYXRvci5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge0l0ZW1TaG93Y2FzZX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSAkLm1hcChhbGxfbW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgLy8gdHJhbnNtdXRlL3ZhYWwgbW9kc1xyXG4gICAgICAgICAgICAgICAgaWYgKCFUcmFuc211dGUubW9kX2ZpbHRlcihtb2QpICYmIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAhVmFhbC5tb2RfZmlsdGVyKG1vZCkgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgIVRhbGlzbWFuLm1vZF9maWx0ZXIobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoK21vZC5HZW5lcmF0aW9uVHlwZSA9PT0gTW9kLk1PRF9UWVBFLlRBTElTTUFOKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBBcHBsaWNhYmxlTW9kKG1vZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICgrbW9kLkRvbWFpbiA9PT0gTW9kLkRPTUFJTi5NQVNURVIpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBtYXN0ZXJtb2Q/ID0+IGxvb2sgZm9yIGNyYWZ0aW5nYmVuY2hcclxuICAgICAgICAgICAgICAgICAgICB2YXIgY3JhZnRpbmdiZW5jaG9wdGlvbiA9ICQubWFwKE1hc3Rlck1vZC5jcmFmdGluZ2JlbmNob3B0aW9ucywgZnVuY3Rpb24gKG9wdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoK29wdGlvbi5Nb2RzS2V5ID09PSArbW9kLlJvd3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb247XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgfSlbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFmdGluZ2JlbmNob3B0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1vc3QgbGlrZWx5IGxlZ2FjeVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiY291bGQgbm90IGZpbmQgY3JhZnRpbmdiZW5jaG9wdGlvbiBmb3IgXCIsICttb2RbJ1Jvd3MnXSwgbW9kKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTWFzdGVyTW9kKG1vZCwgY3JhZnRpbmdiZW5jaG9wdGlvbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIHNwYXduYWJsZT9cclxuICAgICAgICAgICAgICAgIGlmIChtb2QuU3Bhd25XZWlnaHRfVGFnc0tleXMgIT09IFwiXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFJvbGxhYmxlTW9kKG1vZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKG1vZHMsIEFwcGxpY2FibGVNb2QpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBvbmx5IGFic3RyYWN0IHNob3djYXNlLCBub3QgZm9yIGFjdHVhbCB1c2FnZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kQ29udGFpbmVyfSBtb2RfY29udGFpbmVyXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWFwcyBtb2Q6OmFwcGxpY2FibGVUbyBhbmQgKGlmIGltcGxlbWVudGVkKSBtb2Q6OnNwYXduYWJsZU9uIFxyXG4gICAgICAgICAqIGlmIHdlIGhhdmUgYWxsIHRoZSBzcGFjZSBmb3IgbW9kcyB3ZSBuZWVkXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgc2hvd2Nhc2VcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBiYXNlaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlNIT1dDQVNFO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSAkLm1hcCh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgbW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChTcGF3bmFibGUuaW1wbGVtZW50ZWRCeShtb2QpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gdmFhbHMgcmVwbGFjZSBzbyB3ZSBkb250IGNhcmUgYWJvdXQgZnVsbCBvciBub3RcclxuICAgICAgICAgICAgICAgIGlmIChtb2QuaXNUeXBlKFwidmFhbFwiKSAmJiBtb2QuYXBwbGljYWJsZV9ieXRlICYgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuRE9NQUlOX0ZVTEwpIHtcclxuICAgICAgICAgICAgICAgICAgICBtb2QuYXBwbGljYWJsZV9ieXRlIF49IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkRPTUFJTl9GVUxMO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ3JlcHMgbW9kOjphcHBsaWNhYmxlVG8gYW5kIChpZiBpbXBsZW1lbnRlZCkgbW9kOjpzcGF3bmFibGVPbiBcclxuICAgICAgICAgKiBpZiB3ZSBoYXZlIGFsbCB0aGUgc3BhY2UgZm9yIG1vZHMgd2UgbmVlZFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSBzaG93Y2FzZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGJhc2VpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuU0hPV0NBU0U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbW9kcyA9ICQubWFwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSwgc3VjY2VzcykgJiYgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICghU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSB8fCBtb2Quc3Bhd25hYmxlT24oYmFzZWl0ZW0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHZhYWxzIHJlcGxhY2Ugc28gd2UgZG9udCBjYXJlIGFib3V0IGZ1bGwgb3Igbm90XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZC5pc1R5cGUoXCJ2YWFsXCIpICYmIG1vZC5hcHBsaWNhYmxlX2J5dGUgJiBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5ET01BSU5fRlVMTCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2QuYXBwbGljYWJsZV9ieXRlIF49IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkRPTUFJTl9GVUxMO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIkl0ZW0gU2hvd2Nhc2VcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBJdGVtU2hvd2Nhc2U7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIE1vZEdlbmVyYXRvciA9IHJlcXVpcmUoJy4vTW9kR2VuZXJhdG9yJyk7XHJcbiAgICB2YXIgTWFzdGVyTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9NYXN0ZXJNb2QnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIFxyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBNYXN0ZXJiZW5jaCBleHRlbmRzIE1vZEdlbmVyYXRvclxyXG4gICAgICogXHJcbiAgICAgKiBpbmdhbWUgcmVwcmVzZW50YXRpb24gb2YgYSBDcmFmdGluZ2JlbmNoXHJcbiAgICAgKi9cclxuICAgIHZhciBNYXN0ZXJiZW5jaCA9IE1vZEdlbmVyYXRvci5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIE1hc3Rlck1vZC5jcmFmdGluZ2JlbmNob3B0aW9ucyBuZWVkcyB0byBiZSBpbml0aWFsaXplZFxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IG5wY19tYXN0ZXJfa2V5IE5QQ01hc3RlcktleSBjb2x1bW5cclxuICAgICAgICAgKiBAcmV0dXJucyB7TWFzdGVyYmVuY2h9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzLCBucGNfbWFzdGVyX2tleSkge1xyXG4gICAgICAgICAgICAvLyBhbGwgb3B0aW9uc1xyXG4gICAgICAgICAgICAvLyBjcmFmdGluZ2JlbmNob3B0aW9ucyBpbnN0YW5jZW9mIHt9IHNvIHdlIGNhbnQgdXNlIGdyZXBcclxuICAgICAgICAgICAgdGhpcy5jcmFmdGluZ2JlbmNob3B0aW9ucyA9ICQubWFwKE1hc3Rlck1vZC5jcmFmdGluZ2JlbmNob3B0aW9ucywgZnVuY3Rpb24gKG9wdGlvbikge1xyXG4gICAgICAgICAgICAgICAgaWYgKCtvcHRpb24uTlBDTWFzdGVyS2V5ID09PSBucGNfbWFzdGVyX2tleSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb247XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBpbml0IG1vZHNcclxuICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICogfG1vZHN8ID4+IHxjcmFmdGluZ2JlbmNob3B0aW9uc3wgc28gd2UgbG9vcCB0aHJvdWdoXHJcbiAgICAgICAgICAgICAqIG1vZHMgYW5kIGdyZXAgb3B0aW9ucyBpbnN0ZWFkIG9mIGxvb3BpbmcgdGhyb3VnaCBvcHRpb25zIFxyXG4gICAgICAgICAgICAgKiBhbmQgZ3JlcCBtb2RcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoJC5tYXAoYWxsX21vZHMsIGZ1bmN0aW9uIChtb2RfcHJvcHMpIHtcclxuICAgICAgICAgICAgICAgIGlmICgrbW9kX3Byb3BzLkRvbWFpbiA9PT0gTW9kLkRPTUFJTi5NQVNURVIpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBtYXN0ZXJtb2Q/ID0+IGxvb2sgZm9yIGNyYWZ0aW5nYmVuY2hcclxuICAgICAgICAgICAgICAgICAgICB2YXIgY3JhZnRpbmdiZW5jaG9wdGlvbiA9ICQuZ3JlcCh0aGF0LmNyYWZ0aW5nYmVuY2hvcHRpb25zLCBmdW5jdGlvbiAob3B0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiArb3B0aW9uLk1vZHNLZXkgPT09ICttb2RfcHJvcHMuUm93cztcclxuICAgICAgICAgICAgICAgICAgICB9KVswXTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWNyYWZ0aW5nYmVuY2hvcHRpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gbW9zdCBsaWtlbHkgbGVnYWN5XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2coXCJjb3VsZCBub3QgZmluZCBjcmFmdGluZ2JlbmNob3B0aW9uIGZvciBcIiwgK21vZFsnUm93cyddLCBtb2QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBNYXN0ZXJNb2QobW9kX3Byb3BzLCBjcmFmdGluZ2JlbmNob3B0aW9uKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pLCBNYXN0ZXJNb2QpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcG9zc2libGUgaW50ZXJmYWNlIGJldHdlZW4gZ3VpIGFuZCBjbGFzc1xyXG4gICAgICAgICAgICB0aGlzLmNob3Nlbl9tb2QgPSBudWxsO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYXBwbGllcyBhIGNob3NlbiBjcmFmdGluZ2JlbmNob3B0aW9uXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25faW5kZXggb3B0aW9uX2luZGV4IHdpdGhpbiB0aGlzLmNyYWZ0aW5nYmVuY2hvcHRpb25zXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGJhc2VpdGVtLCBvcHRpb25faW5kZXgpIHtcclxuICAgICAgICAgICAgdmFyIG1vZCwgb2xkX3Jhcml0eTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIG9wdGlvbiB3aXRoaW4gb3B0aW9uc1xyXG4gICAgICAgICAgICB2YXIgb3B0aW9uID0gdGhpcy5jcmFmdGluZ2JlbmNob3B0aW9uc1tvcHRpb25faW5kZXhdO1xyXG4gICAgICAgICAgICBpZiAob3B0aW9uID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBtb2QgPSAkLmdyZXAodGhpcy5nZXRBdmFpbGFibGVNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiArbW9kLmdldFByb3AoXCJSb3dzXCIpID09PSArb3B0aW9uLk1vZHNLZXk7XHJcbiAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gdmFsaWQgbW9kP1xyXG4gICAgICAgICAgICBpZiAoIShtb2QgaW5zdGFuY2VvZiBNYXN0ZXJNb2QpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhtb2QsIFwibmVlZHMgdG8gYmUgaW5zdGFuY2VvZiBNYXN0ZXJNb2RcIik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHdoaXRlIGdldHMgdXBncmFkZWQgdG8gYmx1ZVxyXG4gICAgICAgICAgICBvbGRfcmFyaXR5ID0gYmFzZWl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpZiAob2xkX3Jhcml0eSA9PT0gSXRlbS5SQVJJVFkuTk9STUFMKSB7XHJcbiAgICAgICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5NQUdJQztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gbW9kIGFwcGxpY2FibGVcclxuICAgICAgICAgICAgaWYgKG1vZC5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYmFzZWl0ZW0uYWRkTW9kKG1vZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHJldHVybiB0byBvbGQgcmFyaXR5IG9uIGZhaWx1cmVcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGV2ZXJ5IGl0ZW0gaXMgd2VsY29tZVxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdHJpbmdzOiBbXSxcclxuICAgICAgICAgICAgICAgIGJpdHM6IFtdXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBncmVwcyBtb2Q6OmFwcGxpY2FibGVUbyBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtb2RzOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgYmx1ZSBpZiB3aGl0ZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGJhc2VpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgaWYgKG9sZF9yYXJpdHkgPT09IEl0ZW0uUkFSSVRZLk5PUk1BTCkge1xyXG4gICAgICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gJC5ncmVwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVyb2xsXHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdyZXBzIG1vZDo6YXBwbGljYWJsZVRvXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgYmx1ZSBpZiB3aGl0ZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGJhc2VpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgaWYgKG9sZF9yYXJpdHkgPT09IEl0ZW0uUkFSSVRZLk5PUk1BTCkge1xyXG4gICAgICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gJC5tYXAodGhpcy5nZXRBdmFpbGFibGVNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIG1vZC5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZDtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZXJvbGxcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jcmFmdGluZ2JlbmNob3B0aW9uc1swXS5NYXN0ZXJOYW1lU2hvcnQ7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTWFzdGVyYmVuY2g7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi4vSW5oZXJpdGFuY2UnKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICBpZiAoJCA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvKlxyXG4gICAgICogYWJzdHJhY3QgQ2xhc3MgTW9kR2VuZXJhdG9yIGltcGxlbWVudHMgQXBwbGljYWJsZVxyXG4gICAgICovXHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5W21vZHNdfSBtb2RfY29sbGVjdGlvblxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBtb2Rfa2xhc3NcclxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBmaWx0ZXIgZmlsdGVyIGZvciBtb2RfcHJvcHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kR2VuZXJhdG9yfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChtb2RfY29sbGVjdGlvbiwgbW9kX2tsYXNzLCBmaWx0ZXIpIHtcclxuICAgICAgICAgICAgdGhpcy51c2VzID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGZpbHRlciA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIC8vIGR1bW15IGZpbHRlclxyXG4gICAgICAgICAgICAgICAgZmlsdGVyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdHJ1ZTsgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gYWxyZWFkeSBmaWx0ZXJlZD9cclxuICAgICAgICAgICAgaWYgKG1vZF9jb2xsZWN0aW9uWzBdIGluc3RhbmNlb2YgbW9kX2tsYXNzKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmF2YWlsYWJsZV9tb2RzID0gbW9kX2NvbGxlY3Rpb247XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmF2YWlsYWJsZV9tb2RzID0gJC5tYXAobW9kX2NvbGxlY3Rpb24sIGZ1bmN0aW9uIChtb2RfcHJvcHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZmlsdGVyKG1vZF9wcm9wcykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBtb2Rfa2xhc3MobW9kX3Byb3BzKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQXBwbGljYWJsZVxyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWJzdHJhY3RcclxuICAgICAgICAgKiBAcGFyYW0ge01vZENvbnRhaW5lcn0gbW9kX2NvbnRhaW5lclxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5W01vZF19XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0QXZhaWxhYmxlTW9kczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hdmFpbGFibGVfbW9kcy5zbGljZSgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbW9kczogZnVuY3Rpb24gKG1vZF9jb250YWluZXIsIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lciwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRBdmFpbGFibGVNb2RzKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhYnN0cmFjdFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kQ29udGFpbmVyfSBtb2RfY29udGFpbmVyXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNldEFwcGxpY2FibGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlVOU0NBTk5FRDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFic3RyYWN0XHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnYWJzdHJhY3QnO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZUNhY2hlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hcHBsaWNhYmxlX2J5dGU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjaG9vc2VNb2Q6IGZ1bmN0aW9uIChiYXNlaXRlbSkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSB0aGlzLm1vZHMoYmFzZWl0ZW0pO1xyXG4gICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBUT0RPIHNwYXdud2VpZ2h0XHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtb2RzLmxlbmd0aCAtIDEpKV07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIkFic3RyYWN0TW9kR2VuZXJhdG9yXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IFxyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZEdlbmVyYXRvcjtcclxufSkuY2FsbCh0aGlzKTtcclxuXHJcbiIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4uL0luaGVyaXRhbmNlJyk7XHJcbiAgICB2YXIgVHJhbnNtdXRlID0gcmVxdWlyZSgnLi9UcmFuc211dGUnKTtcclxuICAgIHZhciBBdWdtZW50ID0gcmVxdWlyZSgnLi9BdWdtZW50Jyk7XHJcbiAgICB2YXIgQWx0ZXJhdGlvbiA9IHJlcXVpcmUoJy4vQWx0ZXJhdGlvbicpO1xyXG4gICAgdmFyIFNjb3VyaW5nID0gcmVxdWlyZSgnLi9TY291cmluZycpO1xyXG4gICAgdmFyIFJlZ2FsID0gcmVxdWlyZSgnLi9SZWdhbCcpO1xyXG4gICAgdmFyIEFsY2hlbXkgPSByZXF1aXJlKCcuL0FsY2hlbXknKTtcclxuICAgIHZhciBDaGFvcyA9IHJlcXVpcmUoJy4vQ2hhb3MnKTtcclxuICAgIHZhciBFeGFsdGVkID0gcmVxdWlyZSgnLi9FeGFsdGVkJyk7XHJcbiAgICB2YXIgSXRlbVNob3djYXNlID0gcmVxdWlyZSgnLi9JdGVtU2hvd2Nhc2UnKTtcclxuICAgIHZhciBFbmNoYW50bWVudGJlbmNoID0gcmVxdWlyZSgnLi9FbmNoYW50bWVudGJlbmNoJyk7XHJcbiAgICBcclxuICAgIHZhciBNb2RHZW5lcmF0b3JGYWN0b3J5ID0gQ2xhc3MuZXh0ZW5kKHt9KTtcclxuICAgIFxyXG4gICAgTW9kR2VuZXJhdG9yRmFjdG9yeS5idWlsZCA9IGZ1bmN0aW9uIChpZGVudCwgYWxsX21vZHMpIHtcclxuICAgICAgICB2YXIgZ2VuZXJhdG9yID0gTW9kR2VuZXJhdG9yRmFjdG9yeS5HRU5FUkFUT1JTW2lkZW50XTtcclxuICAgICAgICBpZiAoIWdlbmVyYXRvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcImNvdWxkIG5vdCBpZGVudGlmeSBcIiwgaWRlbnQpO1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG5ldyBnZW5lcmF0b3IuY29uc3RydWN0b3IoYWxsX21vZHMpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgTW9kR2VuZXJhdG9yRmFjdG9yeS5HRU5FUkFUT1JTID0ge1xyXG4gICAgICAgIFRSQU5TTVVURToge1xyXG4gICAgICAgICAgICBrbGFzczogXCJUcmFuc211dGVcIixcclxuICAgICAgICAgICAgbmFtZTogXCJPcmIgb2YgVHJhbnNtdXRhdGlvblwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDdXJyZW5jeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJVcGdyYWRlcyBhIG5vcm1hbCBpdGVtIHRvIGEgbWFnaWMgaXRlbVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSaWdodCBjbGljayB0aGlzIGl0ZW0gdGhlbiBsZWZ0IGNsaWNrIGEgbm9ybWFsIGl0ZW0gdG8gYXBwbHlcIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogVHJhbnNtdXRlXHJcbiAgICAgICAgfSxcclxuICAgICAgICBBVUdNRU5UOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIkF1Z21lbnRcIixcclxuICAgICAgICAgICAgbmFtZTogXCJPcmIgb2YgQXVnbWVudGF0aW9uXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkN1cnJlbmN5XCIsXHJcbiAgICAgICAgICAgICAgICBcIkVuY2hhbnRzIGEgbWFnaWMgaXRlbSB3aXRoIGEgbmV3IHJhbmRvbSBwcm9wZXJ0eVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSaWdodCBjbGljayB0aGlzIGl0ZW0gdGhlbiBsZWZ0IGNsaWNrIGEgbm9ybWFsIGl0ZW0gdG8gYXBwbHlcIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogQXVnbWVudFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQUxURVJBVElPTjoge1xyXG4gICAgICAgICAgICBrbGFzczogXCJBbHRlcmF0aW9uXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiT3JiIG9mIEFsdGVyYXRpb25cIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3VycmVuY3lcIixcclxuICAgICAgICAgICAgICAgIFwiUmVmb3JnZXMgYSBtYWdpYyBpdGVtIHdpdGggbmV3IHJhbmRvbSBwcm9wZXJ0aWVzXCIsXHJcbiAgICAgICAgICAgICAgICBcIlJpZ2h0IGNsaWNrIHRoaXMgaXRlbSB0aGVuIGxlZnQgY2xpY2sgYSBub3JtYWwgaXRlbSB0byBhcHBseVwiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBBbHRlcmF0aW9uXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTQ09VUklORzoge1xyXG4gICAgICAgICAgICBrbGFzczogXCJTY291cmluZ1wiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIk9yYiBvZiBTY291cmluZ1wiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDdXJyZW5jeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSZW1vdmVzIGFsbCBwcm9wZXJ0aWVzIGZyb20gYW4gaXRlbVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSaWdodCBjbGljayB0aGlzIGl0ZW0gdGhlbiBsZWZ0IGNsaWNrIGEgbm9ybWFsIGl0ZW0gdG8gYXBwbHlcIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogU2NvdXJpbmdcclxuICAgICAgICB9LFxyXG4gICAgICAgIFJFR0FMOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIlJlZ2FsXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiUmVnYWwgT3JiXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkN1cnJlbmN5XCIsXHJcbiAgICAgICAgICAgICAgICBcIlVwZ3JhZGVzIGEgbWFnaWMgaXRlbSB0byBhIHJhcmUgaXRlbVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSaWdodCBjbGljayB0aGlzIGl0ZW0gdGhlbiBsZWZ0IGNsaWNrIGEgbWFnaWMgaXRlbSB0byBhcHBseSBpdC4gQ3VycmVudCBwcm9wZXJ0aWVzIGFyZSByZXRhaW5lZCBhbmQgYSBuZXcgb25lIGlzIGFkZGVkLlwiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBSZWdhbFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQUxDSEVNWToge1xyXG4gICAgICAgICAgICBrbGFzczogXCJBbGNoZW15XCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiT3JiIG9mIEFsY2hlbXlcIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3VycmVuY3lcIixcclxuICAgICAgICAgICAgICAgIFwiVXBncmFkZXMgYSBub3JtYWwgaXRlbSB0byByYXJlIGl0ZW1cIixcclxuICAgICAgICAgICAgICAgIFwiUmlnaHQgY2xpY2sgdGhpcyBpdGVtIHRoZW4gbGVmdCBjbGljayBhIG1hZ2ljIGl0ZW0gdG8gYXBwbHkgaXQuIEN1cnJlbnQgcHJvcGVydGllcyBhcmUgcmV0YWluZWQgYW5kIGEgbmV3IG9uZSBpcyBhZGRlZC5cIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogQWxjaGVteVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQ0hBT1M6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiQ2hhb3NcIixcclxuICAgICAgICAgICAgbmFtZTogXCJDaGFvcyBPcmJcIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3VycmVuY3lcIixcclxuICAgICAgICAgICAgICAgIFwiVXBncmFkZXMgYSBtYWdpYyBpdGVtIHRvIGEgcmFyZSBpdGVtXCIsXHJcbiAgICAgICAgICAgICAgICBcIlJpZ2h0IGNsaWNrIHRoaXMgaXRlbSB0aGVuIGxlZnQgY2xpY2sgYSBtYWdpYyBpdGVtIHRvIGFwcGx5IGl0LiBDdXJyZW50IHByb3BlcnRpZXMgYXJlIHJldGFpbmVkIGFuZCBhIG5ldyBvbmUgaXMgYWRkZWQuXCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IENoYW9zXHJcbiAgICAgICAgfSxcclxuICAgICAgICBFWEFMVEVEOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIkV4YWx0ZWRcIixcclxuICAgICAgICAgICAgbmFtZTogXCJFeGFsdGVkIE9yYlwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDdXJyZW5jeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJFbmNoYW50cyBhIHJhcmUgaXRlbSB3aXRoIGEgbmV3IHJhbmRvbSBwcm9wZXJ0eVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSaWdodCBjbGljayB0aGlzIGl0ZW0gdGhlbiBsZWZ0IGNsaWNrIGEgcmFyZSBpdGVtIHRvIGFwcGx5IGl0LiBSYXJlIGl0ZW1zIGNhbiBoYXZlIHVwIHRvIHNpeCByYW5kb20gcHJvcGVydGllcy5cIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogRXhhbHRlZFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgSVRFTVNIT1dDQVNFOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIkl0ZW1TaG93Y2FzZVwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIlNob3djYXNlXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkFsbCBNb2RzXCIsXHJcbiAgICAgICAgICAgICAgICBcInNob3dzIGFsbCBwb3NzaWJsZSBtb2RzXCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IEl0ZW1TaG93Y2FzZVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgRU5DSEFOVE1FTlRCRU5DSDoge1xyXG4gICAgICAgICAgICBrbGFzczogXCJFbmNoYW50bWVudGJlbmNoXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiRW5jaGFudG1lbnRiZW5jaFwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDcmFmdGluZ2JlbmNoXCIsXHJcbiAgICAgICAgICAgICAgICBcImNyYWZ0cyBpbXBsaWNpdCBlbmNoYW50bWVudHNcIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogRW5jaGFudG1lbnRiZW5jaFxyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTW9kR2VuZXJhdG9yRmFjdG9yeTtcclxufSkuY2FsbCh0aGlzKTtcclxuXHJcbiIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgVHJhbnNtdXRlID0gcmVxdWlyZSgnLi9UcmFuc211dGUnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIFxyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIFJlZ2FsIGV4dHJlbmRzIEBsaW5rIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBSZWdhbCBPcmJcclxuICAgICAqL1xyXG4gICAgdmFyIFJlZ2FsID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtSZWdhbH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiUmVnYWxcIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgb25lIHJhbmRvbSBwcm9wIGFuZCB1cGdyYWRlcyB0byByYXJlXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAvLyB1cGdyYWRlIHRvIHJhcmVcclxuICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuUkFSRTtcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG1hcHMgbW9kOjphcHBsaWNhYmxlVG8gYXMgaWYgaXQgd2VyZSBhbHJlYWR5IHJhcmVcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1hcDogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgdXBncmFkZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gdGhpcy5fc3VwZXIoaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ3JlcHMgbW9kOjphcHBsaWNhYmxlVG8gYXMgaWYgaXQgd2VyZSBhbHJlYWR5IHJhcmVcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIC8vIHNpbXVsYXRlIHVwZ3JhZGVcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5SQVJFO1xyXG4gICAgICAgICAgICB2YXIgbW9kcyA9IHRoaXMuX3N1cGVyKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG9ubHkgYXBwbGljYWJsZSB0byBtYWdpY3NcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGJhc2VpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIFNVQ0NFU1MgYnl0ZVxyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSAmPSB+QXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChiYXNlaXRlbS5yYXJpdHkgIT09IEl0ZW0uUkFSSVRZLk1BR0lDKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBSZWdhbC5BUFBMSUNBQkxFX0JZVEUuTk9UX01BR0lDO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKlxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCeXRlU2V0Lmh1bWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZWdhbC5BUFBMSUNBQkxFX0JZVEUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBSZWdhbC5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiUmVnYWwuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJSZWdhbCBPcmJcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgUmVnYWwuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfTUFHSUM6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gUmVnYWw7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDdXJyZW5jeSA9IHJlcXVpcmUoJy4vQ3VycmVuY3knKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgTWFzdGVyTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9NYXN0ZXJNb2QnKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIFNjb3VyaW5nIGV4dGVuZHMgQGxpbmsgQ3VycmVuY3lcclxuICAgICAqL1xyXG4gICAgdmFyIFNjb3VyaW5nID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBubyBtb2RzIG5lZWQgZm9yIFNjb3VyaW5nLiBpdCBkb2VzIHRoZSBleGFjdCBvcHBvc2l0ZSBvZiBnZW5lcmF0aW5nIG1vZHNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcmV0dXJucyB7U2NvdXJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihbXSk7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIlNjb3VyaW5nXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhcHBsaWVzIE9yYiBvZiBTY291cmluZyB0byBhbiBpdGVtXHJcbiAgICAgICAgICogY29uc2lkZXJzIGxvY2tlZCBhZmZpeGVzIG1ldGFtb2RzXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChpdGVtKSB7IFxyXG4gICAgICAgICAgICB2YXIgbG9ja2VkX3ByZWZpeGVzLCBsb2NrZWRfc3VmZml4ZXM7XHJcbiAgICAgICAgICAgIHZhciByZW1haW5pbmdfcHJlZml4ZXMsIHJlbWFpbmluZ19zdWZmaXhlcztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgbG9ja2VkX3ByZWZpeGVzID0gaXRlbS5pbk1vZHMoTWFzdGVyTW9kLk1FVEFNT0QuTE9DS0VEX1BSRUZJWEVTKSAhPT0gLTE7XHJcbiAgICAgICAgICAgICAgICBsb2NrZWRfc3VmZml4ZXMgPSBpdGVtLmluTW9kcyhNYXN0ZXJNb2QuTUVUQU1PRC5MT0NLRURfU1VGRklYRVMpICE9PSAtMTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJC5lYWNoKGl0ZW0uZ2V0QWZmaXhlcygpLCBmdW5jdGlvbiAoXywgbW9kKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGlmIChtb2QuaXNQcmVmaXgoKSAmJiAhbG9ja2VkX3ByZWZpeGVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnJlbW92ZU1vZChtb2QpO1xyXG4gICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZC5pc1N1ZmZpeCgpICYmICFsb2NrZWRfc3VmZml4ZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucmVtb3ZlTW9kKG1vZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBzZXQgY29ycmVjdCByYXJpdHlcclxuICAgICAgICAgICAgICAgIHJlbWFpbmluZ19wcmVmaXhlcyA9IGl0ZW0uZ2V0UHJlZml4ZXMoKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICByZW1haW5pbmdfc3VmZml4ZXMgPSBpdGVtLmdldFN1ZmZpeGVzKCkubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAocmVtYWluaW5nX3ByZWZpeGVzID09PSAwICYmIHJlbWFpbmluZ19zdWZmaXhlcyA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTk9STUFMO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChyZW1haW5pbmdfcHJlZml4ZXMgPiAxIHx8IHJlbWFpbmluZ19zdWZmaXhlcyA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY2hlY2tzIGlmIG5vcm1hbCBvciB1bmlxdWUgcmFyaXR5IGFuZCByZXR1cm5zIGZhbHNlXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gc3VjY2VzcyB3aGl0ZWxpc3RlZCBAbGluayBTY291cmluZy5BUFBMSUNBQkxFX0JZVEUgdGhhdCBpcyBjb25zaWRlcmVkIGEgc3VjY2Vzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIHN1Y2Nlc3NcclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzd2l0Y2ggKGJhc2VpdGVtLnJhcml0eSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5OT1JNQUw6XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gU2NvdXJpbmcuQVBQTElDQUJMRV9CWVRFLkFMUkVBRFlfV0hJVEU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLlVOSVFVRTpcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBTY291cmluZy5BUFBMSUNBQkxFX0JZVEUuVU5JUVVFO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2NvdXJpbmcuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2NvdXJpbmcuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlNjb3VyaW5nLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiT3JiIG9mIFNjb3VyaW5nXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogZmFpbHVyZSBiaXRzXHJcbiAgICAgKi9cclxuICAgIFNjb3VyaW5nLkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBDdXJyZW5jeVxyXG4gICAgICAgIFVOU0NBTk5FRDogMCxcclxuICAgICAgICBTVUNDRVNTOiAxLFxyXG4gICAgICAgIE5PVF9BTl9JVEVNOiAyLFxyXG4gICAgICAgIC8vIGV4dGVuZGVkXHJcbiAgICAgICAgQUxSRUFEWV9XSElURTogNCxcclxuICAgICAgICBVTklRVUU6IDhcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gU2NvdXJpbmc7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIE1vZEdlbmVyYXRvciA9IHJlcXVpcmUoJy4vTW9kR2VuZXJhdG9yJyk7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBUT0RPXHJcbiAgICAgKi9cclxuICAgIHZhciBUYWxpc21hbiA9IE1vZEdlbmVyYXRvci5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIFRhbGlzbWFuLm1vZF9maWx0ZXIgPSBmdW5jdGlvbiAobW9kX3Byb3BzKSB7XHJcbiAgICAgICAgLy8gdGFsaXNtYW4gd2lsZGNhcmRcclxuICAgICAgICByZXR1cm4gW01vZC5NT0RfVFlQRS5FTkNIQU5UTUVOVF0uaW5kZXhPZigrbW9kX3Byb3BzLkdlbmVyYXRpb25UeXBlKSAhPT0gLTE7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFRhbGlzbWFuO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOiBmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gcmVxdWlyZSgnLi9DdXJyZW5jeScpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgdmFyIE1vZCA9IHJlcXVpcmUoJy4uL21vZHMvTW9kJyk7XHJcbiAgICBcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBUcmFuc211dGUgZXh0ZW5kcyBDdXJyZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiBpbmdhbWUgcmVwcmVzZW50YXRpb24gb2YgT3JiIG9mIFRyYW5zbXV0YXRpb25cclxuICAgICAqL1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtUcmFuc211dGV9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBUcmFuc211dGUubW9kX2ZpbHRlcik7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIlRyYW5zbXV0ZVwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyAxLTIgbW9kc1xyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gdXBncmFkZSB0byByYXJlXHJcbiAgICAgICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk1BR0lDO1xyXG5cclxuICAgICAgICAgICAgICAgIGl0ZW0uYWRkTW9kKHRoaXMuY2hvb3NlTW9kKGl0ZW0pKTtcclxuICAgICAgICAgICAgICAgIGlmIChNYXRoLnJhbmRvbSgpIDw9IDAuNSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uYWRkTW9kKHRoaXMuY2hvb3NlTW9kKGl0ZW0pKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG1hcHMgbW9kOjphcHBsaWNhYmxlVG8gYXMgaWYgaXQgd2VyZSBhbHJlYWR5IG1hZ2ljXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXA6IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIC8vIHNpbXVsYXRlIHVwZ3JhZGVcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5NQUdJQztcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSB0aGlzLl9zdXBlcihpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBncmVwcyBtb2Q6OmFwcGxpY2FibGVUbyBhcyBpZiBpdCB3ZXJlIGFscmVhZHkgbWFnaWNcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IHN1Y2Nlc3NcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbW9kczogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgdXBncmFkZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk1BR0lDO1xyXG4gICAgICAgICAgICB2YXIgbW9kcyA9IHRoaXMuX3N1cGVyKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgU1VDQ0VTUyBieXRlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlICY9IH5BcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtLnJhcml0eSAhPT0gSXRlbS5SQVJJVFkuTk9STUFMKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBUcmFuc211dGUuQVBQTElDQUJMRV9CWVRFLk5PVF9XSElURTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVHJhbnNtdXRlLkFQUExJQ0FCTEVfQllURSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFRyYW5zbXV0ZS5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiVHJhbnNtdXRlLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiT3JiIG9mIFRyYW5zbXV0YXRpb25cIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgVHJhbnNtdXRlLkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBDdXJyZW5jeVxyXG4gICAgICAgIFVOU0NBTk5FRDogMCxcclxuICAgICAgICBTVUNDRVNTOiAxLFxyXG4gICAgICAgIE5PVF9BTl9JVEVNOiAyLFxyXG4gICAgICAgIC8vIGV4dGVuZGVkXHJcbiAgICAgICAgTk9UX1dISVRFOiA0XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBUcmFuc211dGUubW9kX2ZpbHRlciA9IGZ1bmN0aW9uIChtb2RfcHJvcHMpIHtcclxuICAgICAgICAvLyBwcmVmaXgvc3VmZml4IG9ubHlcclxuICAgICAgICByZXR1cm4gW01vZC5NT0RfVFlQRS5QUkVGSVgsIE1vZC5NT0RfVFlQRS5TVUZGSVhdLmluZGV4T2YoK21vZF9wcm9wcy5HZW5lcmF0aW9uVHlwZSkgIT09IC0xO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBUcmFuc211dGU7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gcmVxdWlyZSgnLi9DdXJyZW5jeScpO1xyXG4gICAgdmFyIE1vZCA9IHJlcXVpcmUoJy4uL21vZHMvTW9kJyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgVmFhbCBleHRlbmRzIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBWYWFsIE9yYiBvbmx5IHJlZ2FyZGluZyBpbXBsaWNpdCBjb3JydXB0aW9uc1xyXG4gICAgICovXHJcbiAgICB2YXIgVmFhbCA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtWYWFsfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChhbGxfbW9kcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihhbGxfbW9kcywgVmFhbC5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiVmFhbFwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJWYWFsIE9yYlwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBWYWFsLm1vZF9maWx0ZXIgPSBmdW5jdGlvbiAobW9kX3Byb3BzKSB7XHJcbiAgICAgICAgLy8gdmFhbCBpbXBsaWNpdHNcclxuICAgICAgICByZXR1cm4gW01vZC5NT0RfVFlQRS5WQUFMXS5pbmRleE9mKCttb2RfcHJvcHMuR2VuZXJhdGlvblR5cGUpICE9PSAtMTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gVmFhbDtcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBnbG9iYWwgQ2xhc3MgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4vSW5oZXJpdGFuY2UnKTtcclxuICAgIFxyXG4gICAgdmFyIFBhdGggPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChwYXRoX3N0cmluZykge1xyXG4gICAgICAgICAgICB0aGlzLnBhdGggPSBwYXRoX3N0cmluZy5zcGxpdChcIi9cIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLmlzX2Fic29sdXRlID0gdGhpcy5wYXRoWzBdID09PSAnJztcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBYnNvbHV0ZSgpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnBhdGguc2hpZnQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZ2V0QmFzZW5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aFt0aGlzLnBhdGgubGVuZ3RoIC0gMV07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXREaXJlY3RvcmllczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoLnNsaWNlKDAsIHRoaXMucGF0aC5sZW5ndGggLSAxKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzQWJzb2x1dGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNfYWJzb2x1dGU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuZXh0RmlsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wYXRoWzBdICE9PSAnJykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aC5zaGlmdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldEJhc2VuYW1lKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gUGF0aDtcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBnbG9iYWwgQ2xhc3MgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4vSW5oZXJpdGFuY2UnKTtcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBJbnRlcmZhY2UgU2VyaWFsaXplYWJsZVxyXG4gICAgICovXHJcbiAgICB2YXIgU2VyaWFsaXplYWJsZSA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgc2VyaWFsaXplOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBrbGFzczogXCJcIixcclxuICAgICAgICAgICAgICAgIGFyZ3M6IFtdLFxyXG4gICAgICAgICAgICAgICAgY29uc3RydWN0b3I6IENsYXNzIC8vIGEgQ2xhc3MgaW5zdGFuY2VcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdmFyIHNlcmlhbGl6ZWRfc3RydWN0ID0gbmV3IFNlcmlhbGl6ZWFibGUoKS5zZXJpYWxpemUoKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzM2MjQ3MS9ob3ctY2FuLWktY2FsbC1hLWphdmFzY3JpcHQtY29uc3RydWN0b3ItdXNpbmctY2FsbC1vci1hcHBseVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNlcmlhbGl6ZWRcclxuICAgICAqIEByZXR1cm5zIHtNb2RGYWN0b3J5X0wxLk1vZEZhY3RvcnkuZGVzZXJpYWxpemUuRmFjdG9yeUZ1bmN0aW9ufVxyXG4gICAgICovXHJcbiAgICBTZXJpYWxpemVhYmxlLmRlc2VyaWFsaXplID0gZnVuY3Rpb24gKHNlcmlhbGl6ZWQpIHtcclxuICAgICAgICBpZiAoIVNlcmlhbGl6ZWFibGUuY2hlY2tTdHJ1Y3Qoc2VyaWFsaXplZCkpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcInN0cnVjdCBkb2VzbnQgbWF0Y2ggaW50ZXJmYWNlIHN0cnVjdFwiLCBzZXJpYWxpemVkLCBzZXJpYWxpemVkX3N0cnVjdCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGNvbnN0cnVjdG9yID0gc2VyaWFsaXplZC5jb25zdHJ1Y3RvcjtcclxuICAgICAgICB2YXIgYXJncyA9IFtudWxsXS5jb25jYXQoc2VyaWFsaXplZC5hcmdzKTtcclxuICAgICAgICB2YXIgZmFjdG9yeUZ1bmN0aW9uID0gY29uc3RydWN0b3IuYmluZC5hcHBseShjb25zdHJ1Y3RvciwgYXJncyk7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBmYWN0b3J5RnVuY3Rpb24oKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIFNlcmlhbGl6ZWFibGUuaW1wbGVtZW50ZWRCeSA9IGZ1bmN0aW9uIChjbGF6eikge1xyXG4gICAgICAgIGlmICghKGNsYXp6IGluc3RhbmNlb2YgQ2xhc3MpIHx8IHR5cGVvZiBjbGF6ei5zZXJpYWxpemUgIT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gU2VyaWFsaXplYWJsZS5jaGVja1N0cnVjdChjbGF6ei5zZXJpYWxpemVkKCkpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgU2VyaWFsaXplYWJsZS5jaGVja1N0cnVjdCA9IGZ1bmN0aW9uIChzZXJpYWxpemVkKSB7XHJcbiAgICAgICAgdmFyIGltcGxlbWVudGVkX2J5ID0gdHJ1ZTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBjaGVjayBpZiBlYWNoIHByb3BlcnR5IGluIHRoZSBzdHJ1Y3QgaGFzIHRoZSBzYW1lIHR5cGVcclxuICAgICAgICAkLmVhY2goc2VyaWFsaXplZF9zdHJ1Y3QsIGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2VyaWFsaXplZFtrZXldICE9PSB0eXBlb2YgdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGltcGxlbWVudGVkX2J5ID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7IC8vIGJyZWFrXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gaW1wbGVtZW50ZWRfYnk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFNlcmlhbGl6ZWFibGU7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIEludGVyZmFjZVxyXG4gICAgICovXHJcbiAgICB2YXIgU3Bhd25hYmxlID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc3Bhd253ZWlnaHRfY2FjaGVkID0gMDtcclxuICAgICAgICAgICAgdGhpcy5zcGF3bmNoYW5jZSA9IG51bGw7XHJcbiAgICAgICAgICAgIHRoaXMuc3Bhd25hYmxlX2J5dGUgPSBTcGF3bmFibGUuU1VDQ0VTUztcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNwYXduYWJsZU9uOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9LFxyXG4gICAgICAgIGh1bWFuU3Bhd25jaGFuY2U6IGZ1bmN0aW9uIChwcmVjaXNpb24pIHtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJlc2V0U3Bhd25hYmxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3Bhd25hYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3Bhd25hYmxlQ2FjaGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBTcGF3bmFibGUubWFwID0gZnVuY3Rpb24gKG1vZF9jb2xsZWN0aW9uLCBtb2RfY29udGFpbmVyKSB7XHJcbiAgICAgICAgcmV0dXJuICQubWFwKG1vZF9jb2xsZWN0aW9uLnNsaWNlKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgaWYgKFNwYXduYWJsZS5pbXBsZW1lbnRlZEJ5KG1vZCkpIHtcclxuICAgICAgICAgICAgICAgIG1vZC5zcGF3bmFibGVPbihtb2RfY29udGFpbmVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgU3Bhd25hYmxlLm1vZHMgPSBmdW5jdGlvbiAobW9kX2NvbGxlY3Rpb24sIG1vZF9jb250YWluZXIsIHN1Y2Nlc3MpIHtcclxuICAgICAgICByZXR1cm4gJC5ncmVwKG1vZF9jb2xsZWN0aW9uLnNsaWNlKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuICFTcGF3bmFibGUuaW1wbGVtZW50ZWRCeShtb2QpIHx8IG1vZC5zcGF3bmFibGVPbihtb2RfY29udGFpbmVyLCBzdWNjZXNzKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIGludGVyZmFjZSBwYXR0ZXJuXHJcbiAgICBTcGF3bmFibGUuaW1wbGVtZW50ZWRCeSA9IGZ1bmN0aW9uIChjbGF6eikge1xyXG4gICAgICAgIHJldHVybiAgY2xhenouc3Bhd25hYmxlT24gIT09IF9fdW5kZWZpbmVkO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7QXJyYXk8U3Bhd25hYmxlPn0gc3Bhd25hYmxlc1xyXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gaWZfY2Igb3B0aW9uYWwgY2FsbGJhY2sgdG8gZmlsdGVyIG1vZHNcclxuICAgICAqIEByZXR1cm5zIHtmbG9hdH1cclxuICAgICAqL1xyXG4gICAgU3Bhd25hYmxlLmNhbGN1bGF0ZVNwYXduY2hhbmNlID0gZnVuY3Rpb24gKHNwYXduYWJsZXMsIGlmX2NiKSB7XHJcbiAgICAgICAgdmFyIHN1bV9zcGF3bndlaWdodCA9IDA7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBpZl9jYiAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBpZl9jYiAgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0cnVlOyB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAkLmVhY2goc3Bhd25hYmxlcywgZnVuY3Rpb24gKF8sIG1vZCkge1xyXG4gICAgICAgICAgICBpZiAoU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSAmJiBpZl9jYihtb2QpKSB7XHJcbiAgICAgICAgICAgICAgICBzdW1fc3Bhd253ZWlnaHQgKz0gbW9kLnNwYXdud2VpZ2h0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuICQubWFwKHNwYXduYWJsZXMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgaWYgKFNwYXduYWJsZS5pbXBsZW1lbnRlZEJ5KG1vZCkgJiYgbW9kLnNwYXdud2VpZ2h0ICE9PSBudWxsICYmIGlmX2NiKG1vZCkpIHtcclxuICAgICAgICAgICAgICAgIG1vZC5zcGF3bmNoYW5jZSA9IG1vZC5zcGF3bndlaWdodCAvIHN1bV9zcGF3bndlaWdodDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIG1vZDtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIENvbnZlbnRpb25cclxuICAgIFNwYXduYWJsZS5VTlNDQU5ORUQgPSAwO1xyXG4gICAgU3Bhd25hYmxlLlNVQ0NFU1MgPSAxO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFNwYXduYWJsZTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgR2dwa0VudHJ5ID0gcmVxdWlyZSgnLi9HZ3BrRW50cnknKTtcclxuICAgIHZhciBWYWx1ZVJhbmdlID0gcmVxdWlyZSgnLi9WYWx1ZVJhbmdlJyk7XHJcbiAgICByZXF1aXJlKCcuL2NvbmNlcm5zL0FycmF5Jyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgU3RhdCBleHRlbmRzIEdncGtFbnRyeVxyXG4gICAgICovXHJcbiAgICB2YXIgU3RhdCA9IEdncGtFbnRyeS5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChwcm9wcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihwcm9wcyk7XHJcbiAgICAgICAgICAgIHRoaXMudmFsdWVzID0gbmV3IFZhbHVlUmFuZ2UoMCwgMCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB0OiBmdW5jdGlvbiAob3RoZXJfc3RhdHMsIGxvY2FsaXphdGlvbikge1xyXG4gICAgICAgICAgICBpZiAobG9jYWxpemF0aW9uID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgbG9jYWxpemF0aW9uID0gU3RhdC5sb2NhbGl6YXRpb247XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHZhciBpZCA9IHRoaXMuZ2V0UHJvcChcIklkXCIpO1xyXG4gICAgICAgICAgICBpZiAobG9jYWxpemF0aW9uLmRhdGFbaWRdID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJubyBkZXNjIGZvciBcIiwgaWQpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGlkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgcGFyYW1zID0gdGhpcy50UGFyYW1zKG90aGVyX3N0YXRzLCBsb2NhbGl6YXRpb24pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGxvY2FsaXphdGlvbi50LmFwcGx5KGxvY2FsaXphdGlvbiwgW2lkXS5jb25jYXQocGFyYW1zKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB0UGFyYW1zOiBmdW5jdGlvbiAob3RoZXJfc3RhdHMsIGxvY2FsaXphdGlvbikge1xyXG4gICAgICAgICAgICB2YXIgaWQgPSB0aGlzLmdldFByb3AoXCJJZFwiKTtcclxuICAgICAgICAgICAgdmFyIHBhcmFtcyA9IFt0aGlzLnZhbHVlcy50b0FycmF5KCldO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCFsb2NhbGl6YXRpb24uZGF0YVtpZF0pIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBvdGhlcl9wYXJhbXMgPSBsb2NhbGl6YXRpb24uZGF0YVtpZF0ucGFyYW1zO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG90aGVyX3BhcmFtcyAhPT0gX191bmRlZmluZWQgJiYgb3RoZXJfcGFyYW1zLmxlbmd0aCA+IDEpIHtcclxuICAgICAgICAgICAgICAgIHBhcmFtcyA9ICQubWFwKG90aGVyX3BhcmFtcywgZnVuY3Rpb24gKHBhcmFtX2lkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIHN0YXQgPSAkLmdyZXAob3RoZXJfc3RhdHMsIGZ1bmN0aW9uIChzdGF0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwYXJhbV9pZCA9PT0gc3RhdC5nZXRQcm9wKFwiSWRcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSlbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHN0YXQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRPRE8gbWF5YmUgMCB3aWxsIG1hdGNoIHNvbWV0aGluZz8gYmV0dGVyIG9mIHdpdGggK2luZj9cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtbMCwgMF1dO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIFtzdGF0LnZhbHVlcy50b0FycmF5KCldO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBwYXJhbXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB2YWx1ZVN0cmluZzogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCIoXCIgKyB0aGlzLnZhbHVlcy50b1N0cmluZygpICsgXCIpXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIFN0YXQubG9jYWxpemF0aW9uID0gbnVsbDtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBTdGF0O1xyXG59KSgpOyIsIi8qIGdsb2JhbCBDbGFzcywgVmFsdWVSYW5nZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZShcIi4vSW5oZXJpdGFuY2VcIik7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgVmFsdWVSYW5nZVxyXG4gICAgICogXHJcbiAgICAgKiBhIDItZGltZW5zaW9uYWwgYXJyYXkgd2l0aCBvcGVyYXRpb25zIGZvciBjZXJ0YWluIG1hdGhlbWF0aWNhbCBvcGVyYXRpb25zXHJcbiAgICAgKiBjYW4gY3JlYXRlIHJlY3Vyc2l2ZSBzdHJ1Y3R1cmVzIFsoMi00KS0oNi04KV1cclxuICAgICAqL1xyXG4gICAgdmFyIFZhbHVlUmFuZ2UgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChtaW4sIG1heCkge1xyXG4gICAgICAgICAgICB0aGlzLm1pbiA9IG1pbjtcclxuICAgICAgICAgICAgdGhpcy5tYXggPSBtYXg7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB0b0FycmF5OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5taW4sIHRoaXMubWF4XTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRvRml4ZWQ6IGZ1bmN0aW9uIChwcmVjaXNpb24pIHtcclxuICAgICAgICAgICAgLy8gd2lsbCB0dXJuIDIuMSBpbnRvIDIuMTAgXHJcbiAgICAgICAgICAgIHZhciBtaW4gPSB0aGlzLm1pbi50b0ZpeGVkKHByZWNpc2lvbik7XHJcbiAgICAgICAgICAgIGlmICghKG1pbiBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBidXQgd2l0aCBsZWFkaW5nICsgd2Ugd2lsbCBnZXQgYSBudW1iZXIgYWdhaW5cclxuICAgICAgICAgICAgICAgIG1pbiA9ICttaW47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBtYXggPSB0aGlzLm1heC50b0ZpeGVkKHByZWNpc2lvbik7XHJcbiAgICAgICAgICAgIGlmICghKG1heCBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UpKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBidXQgd2l0aCBsZWFkaW5nICsgd2Ugd2lsbCBnZXQgYSBudW1iZXIgYWdhaW5cclxuICAgICAgICAgICAgICAgIG1heCA9ICttYXg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgVmFsdWVSYW5nZShtaW4sIG1heCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB0b1N0cmluZzogZnVuY3Rpb24gKGRlcHRoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1pbi5lcXVhbHModGhpcy5tYXgpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5taW4udG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGRlcHRoID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgZGVwdGggPSAwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBzaWduYXR1cmUgb2YgbnVtYmVyLnRvU3RyaW5nKHJhZGl4KSB2YXJpZXMgZnJvbSB0aGlzIG1ldGhvZCBzaWcgXHJcbiAgICAgICAgICAgIHZhciBtaW4gPSB0aGlzLm1pbjtcclxuICAgICAgICAgICAgaWYgKG1pbiBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UpIHtcclxuICAgICAgICAgICAgICAgIG1pbiA9IG1pbi50b1N0cmluZyhkZXB0aCArIDEpO1xyXG4gICAgICAgICAgICB9IFxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1heCA9IHRoaXMubWF4O1xyXG4gICAgICAgICAgICBpZiAobWF4IGluc3RhbmNlb2YgVmFsdWVSYW5nZSkge1xyXG4gICAgICAgICAgICAgICAgbWF4ID0gbWF4LnRvU3RyaW5nKGRlcHRoICsgMSk7XHJcbiAgICAgICAgICAgIH0gXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gKGRlcHRoID4gMCA/IFwiKFwiIDogXCJcIikgKyBcclxuICAgICAgICAgICAgICAgICAgICBbbWluLCBtYXhdLmpvaW4oZGVwdGggJSAyID8gVmFsdWVSYW5nZS5zZXBFdmVuIDogVmFsdWVSYW5nZS5zZXBPZGQpICsgXHJcbiAgICAgICAgICAgICAgICAgICAgKGRlcHRoID4gMCA/IFwiKVwiIDogXCJcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBjbG9uZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlUmFuZ2UodGhpcy5taW4sIHRoaXMubWF4KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFkZDogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmFkZFZhbHVlUmFuZ2UodmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFkZFNjYWxhcih2YWx1ZSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhZGRTY2FsYXI6IGZ1bmN0aW9uIChsYW1iZGEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZVJhbmdlKHRoaXMubWluICsgbGFtYmRhLCB0aGlzLm1heCArIGxhbWJkYSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhZGRWYWx1ZVJhbmdlOiBmdW5jdGlvbiAodmFsdWVfcmFuZ2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZVJhbmdlKHZhbHVlX3JhbmdlLmFkZCh0aGlzLm1pbiksIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVfcmFuZ2UuYWRkKHRoaXMubWF4KSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBlcXVhbHM6IGZ1bmN0aW9uIChvdGhlcl92YWx1ZV9yYW5nZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gb3RoZXJfdmFsdWVfcmFuZ2UgaW5zdGFuY2VvZiBWYWx1ZVJhbmdlICYmIFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWluLmVxdWFscyhvdGhlcl92YWx1ZV9yYW5nZS5taW4pICYmIFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWF4LmVxdWFscyhvdGhlcl92YWx1ZV9yYW5nZS5tYXgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXVsdGlwbHk6IGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBWYWx1ZVJhbmdlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tdWx0aXBseVZhbHVlUmFuZ2UodmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm11bHRpcGx5U2NhbGFyKHZhbHVlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG11bHRpcGx5U2NhbGFyOiBmdW5jdGlvbiAobGFtYmRhKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgVmFsdWVSYW5nZSh0aGlzLm1pbiAqIGxhbWJkYSwgdGhpcy5tYXggKiBsYW1iZGEpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXVsdGlwbHlWYWx1ZVJhbmdlOiBmdW5jdGlvbiAodmFsdWVfcmFuZ2UpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZVJhbmdlKHZhbHVlX3JhbmdlLm11bHRpcGx5KHRoaXMubWluKSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZV9yYW5nZS5tdWx0aXBseSh0aGlzLm1heCkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNaZXJvOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvQXJyYXkoKS5pc1plcm8oKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgVmFsdWVSYW5nZS5zZXBPZGQgPSBcIiB0byBcIjtcclxuICAgIFZhbHVlUmFuZ2Uuc2VwRXZlbiA9IFwiLVwiO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFZhbHVlUmFuZ2U7XHJcbn0pKCk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgLyoqXHJcbiAgICAgKiBcclxuICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGV2ZXJ5IHZhbHVlIGluIHRoaXMgYXJyYXkgZXF1YWwgemVyb1xyXG4gICAgICovXHJcbiAgICBBcnJheS5wcm90b3R5cGUuaXNaZXJvID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHZhciBhID0gdGhpcy52YWx1ZU9mKCk7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGEubGVuZ3RoOyBpIDwgbGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBhW2ldLmlzWmVybyA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFhW2ldLmlzWmVybygpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKCthW2ldICE9PSAwKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKlxyXG4gICAgLyoqXHJcbiAgICAgKiBAbGluayB7aHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8xMzQ4NjQ3OS9ob3ctdG8tZ2V0LWFuLWFycmF5LW9mLXVuaXF1ZS12YWx1ZXMtZnJvbS1hbi1hcnJheS1jb250YWluaW5nLWR1cGxpY2F0ZXMtaW4tamF2YX1cclxuICAgICAqIFxyXG4gICAgICogQHJldHVybnMge0FycmF5LnByb3RvdHlwZUBjYWxsO3JldmVyc2VAY2FsbDtmaWx0ZXJAY2FsbDtyZXZlcnNlfVxyXG4gICAgICpcclxuICAgIEFycmF5LnByb3RvdHlwZS51bmlxdWUgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmV2ZXJzZSgpLmZpbHRlcihmdW5jdGlvbiAoZSwgaSwgYXJyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBhcnIuaW5kZXhPZihlLCBpKzEpID09PSAtMTtcclxuICAgICAgICB9KS5yZXZlcnNlKCk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGpRdWVyeSBtYXAgZXF1aXZcclxuICAgICAqIEBwYXJhbSB7dHlwZX0gY2FsbGJhY2tmblxyXG4gICAgICogQHJldHVybnMge0FycmF5LnByb3RvdHlwZUBjYWxsO21hcEBjYWxsO2ZpbHRlcn1cclxuICAgICAqXHJcbiAgICBBcnJheS5wcm90b3R5cGUuJG1hcCA9IGZ1bmN0aW9uIChjYWxsYmFja2ZuKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubWFwKGNhbGxiYWNrZm4pLmZpbHRlcihmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlICE9PSBudWxsO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBpbnRlcnNlY3Rpb24gb2YgdHdvIGFycmF5XHJcbiAgICAgKiBodHRwOi8vanNmaWRkbGUubmV0L25lb3N3Zi9hWHpXdy9cclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHt0eXBlfSBhXHJcbiAgICAgKiBAcGFyYW0ge3R5cGV9IGJcclxuICAgICAqIEByZXR1cm5zIHtBcnJheXxBcnJheS5pbnRlcnNlY3Rfc2FmZS5yZXN1bHR9XHJcbiAgICAgKlxyXG4gICAgQXJyYXkuaW50ZXJzZWN0ID0gZnVuY3Rpb24gKGEsIGIpXHJcbiAgICB7XHJcbiAgICAgIHZhciBhaSA9IGJpPSAwO1xyXG4gICAgICB2YXIgcmVzdWx0ID0gW107XHJcblxyXG4gICAgICB3aGlsZSggYWkgPCBhLmxlbmd0aCAmJiBiaSA8IGIubGVuZ3RoICl7XHJcbiAgICAgICAgIGlmICAgICAgKGFbYWldIDwgYltiaV0gKXsgYWkrKzsgfVxyXG4gICAgICAgICBlbHNlIGlmIChhW2FpXSA+IGJbYmldICl7IGJpKys7IH1cclxuICAgICAgICAgZWxzZSAgdGhleSdyZSBlcXVhbCAqXHJcbiAgICAgICAgIHtcclxuICAgICAgICAgICByZXN1bHQucHVzaChhaSk7XHJcbiAgICAgICAgICAgYWkrKztcclxuICAgICAgICAgICBiaSsrO1xyXG4gICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBBcnJheS5wcm90b3R5cGUuaW50ZXJzZWN0ID0gZnVuY3Rpb24gKG90aGVyX2Fycikge1xyXG4gICAgICAgIHJldHVybiBBcnJheS5pbnRlcnNlY3QodGhpcy52YWx1ZU9mKCksIG90aGVyX2Fycik7XHJcbiAgICB9Oy8vKi9cclxufSkoKTsiLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi4vSW5oZXJpdGFuY2UnKTtcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICBcclxuICAgIC8vIHRvZG8gaWYtZXhpc3RzXHJcbiAgICB2YXIgQnl0ZVNldCA9IENsYXNzLmV4dGVuZCh7fSk7XHJcblxyXG4gICAgLy8gVE9ETyBibGFja2xpc3QgaW5zdGVhZCBvZiBpZ25vcmVcclxuICAgIEJ5dGVTZXQuaHVtYW4gPSBmdW5jdGlvbihieXRlLCBieXRlX3NldCwgaWdub3JlLCBsb2NhbGl6YXRpb25fcGF0aCkge1xyXG4gICAgICAgIHZhciBzdHJpbmdzID0gW107XHJcbiAgICAgICAgdmFyIGJpdHMgPSBbXTtcclxuXHJcbiAgICAgICAgJC5lYWNoKGJ5dGVfc2V0LCBmdW5jdGlvbiAoa2V5LCBiaXQpIHtcclxuICAgICAgICAgICAgaWYgKGJ5dGUgJiBiaXQgJiYgIShieXRlICYgaWdub3JlKSkge1xyXG4gICAgICAgICAgICAgICAgYml0cy5wdXNoKGJpdCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBsb2NhbGl6ZWQgPSBPYmplY3QuYnlTdHJpbmcoQnl0ZVNldC5sb2NhbGl6YXRpb24sIGxvY2FsaXphdGlvbl9wYXRoICsgXCIuXCIgKyBiaXQpO1xyXG4gICAgICAgICAgICAgICAgc3RyaW5ncy5wdXNoKGxvY2FsaXplZCA/IGxvY2FsaXplZCA6IGtleSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgc3RyaW5nczogc3RyaW5ncyxcclxuICAgICAgICAgICAgYml0czogYml0c1xyXG4gICAgICAgIH07XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBCeXRlU2V0LmxvY2FsaXphdGlvbiA9IG51bGw7XHJcbiAgICBcclxuICAgIEJ5dGVTZXQuaW5pdExvY2FsaXphdGlvbiA9IGZ1bmN0aW9uICgkbGVnZW5kcykge1xyXG4gICAgICAgIEJ5dGVTZXQubG9jYWxpemF0aW9uID0ge307XHJcbiAgICAgICAgXHJcbiAgICAgICAgJChcInVsLmxlZ2VuZFwiLCAkbGVnZW5kcykuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciAkbGVnZW5kID0gJCh0aGlzKTtcclxuICAgICAgICAgICAgdmFyIGtsYXNzID0gJGxlZ2VuZC5kYXRhKFwia2xhc3NcIik7XHJcbiAgICAgICAgICAgIHZhciBieXRlX2lkZW50ID0gJGxlZ2VuZC5kYXRhKFwiYnl0ZS1pZGVudFwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChCeXRlU2V0LmxvY2FsaXphdGlvbltrbGFzc10gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBCeXRlU2V0LmxvY2FsaXphdGlvbltrbGFzc10gPSB7fTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgQnl0ZVNldC5sb2NhbGl6YXRpb25ba2xhc3NdW2J5dGVfaWRlbnRdID0ge307XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkKFwibGlcIiwgdGhpcykuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgJGxpID0gJCh0aGlzKTtcclxuICAgICAgICAgICAgICAgIEJ5dGVTZXQubG9jYWxpemF0aW9uW2tsYXNzXVtieXRlX2lkZW50XVskbGkuZGF0YShieXRlX2lkZW50KV0gPSAkbGkudGV4dCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zb2xlLmxvZyhCeXRlU2V0LmxvY2FsaXphdGlvbik7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyB0dXJuIG9mIGV2ZXJ5dGhpbmcgYmxhY2tsaXN0ZWQgKGJ5dGUgeG9yIChieXRlICYgYmxhY2tsaXN0KSA9IGJ5dGUgJiAhYmxhY2tsaXN0KVxyXG4gICAgQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQgPSBmdW5jdGlvbiAoYnl0ZSwgYmxhY2tsaXN0KSB7XHJcbiAgICAgICAgcmV0dXJuIGJ5dGUgJiB+YmxhY2tsaXN0O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBCeXRlU2V0O1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIE1hdGgucmFuZCA9IGZ1bmN0aW9uIChtaW4sIG1heCkge1xyXG4gICAgICAgIC8vIG1hdGgucmFuZG9tKCkgPSBbMCwxKSA9PiBtYXggLSBtaW4gICsgMSA9IFswLDFdXHJcbiAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoKE1hdGgucmFuZG9tKCkgKiAobWF4IC0gbWluICsgMSkpICsgbWluKTtcclxuICAgIH07XHJcbn0pKCk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgTnVtYmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiAob3RoZXJfbnVtYmVyKSB7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBvdGhlcl9udW1iZXIgPT09ICdudW1iZXInICYmIFxyXG4gICAgICAgICAgICAgICAgdGhpcy52YWx1ZU9mKCkgPT09IG90aGVyX251bWJlcjtcclxuICAgIH07XHJcbn0pKCk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy82NDkxNDYzL2FjY2Vzc2luZy1uZXN0ZWQtamF2YXNjcmlwdC1vYmplY3RzLXdpdGgtc3RyaW5nLWtleVxyXG4gICAgT2JqZWN0LmJ5U3RyaW5nID0gZnVuY3Rpb24obywgcykge1xyXG4gICAgICAgIGlmIChzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHMgPSBzLnJlcGxhY2UoL1xcWyhcXHcrKVxcXS9nLCAnLiQxJyk7IC8vIGNvbnZlcnQgaW5kZXhlcyB0byBwcm9wZXJ0aWVzXHJcbiAgICAgICAgcyA9IHMucmVwbGFjZSgvXlxcLi8sICcnKTsgICAgICAgICAgIC8vIHN0cmlwIGEgbGVhZGluZyBkb3RcclxuICAgICAgICB2YXIgYSA9IHMuc3BsaXQoJy4nKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbiA9IGEubGVuZ3RoOyBpIDwgbjsgKytpKSB7XHJcbiAgICAgICAgICAgIHZhciBrID0gYVtpXTtcclxuICAgICAgICAgICAgaWYgKGsgaW4gbykge1xyXG4gICAgICAgICAgICAgICAgbyA9IG9ba107XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG87XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGpRdWVyeSBtYXAgZXF1aXZcclxuICAgICAqIEBwYXJhbSB7dHlwZX0gY2FsbGJhY2tmblxyXG4gICAgICogQHJldHVybnMge0FycmF5LnByb3RvdHlwZUBjYWxsO21hcEBjYWxsO2ZpbHRlcn1cclxuICAgICAqXHJcbiAgICBPYmplY3QucHJvdG90eXBlLiRtYXAgPSBmdW5jdGlvbiAoY2FsbGJhY2tmbikge1xyXG4gICAgICAgIHJldHVybiB0aGlzLm1hcChjYWxsYmFja2ZuKS5maWx0ZXIoZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB2YWx1ZSAhPT0gbnVsbDtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIE9iamVjdC5wcm90b3R5cGUubWFwID0gZnVuY3Rpb24gKGNhbGxiYWNrZm4pIHtcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXMudmFsdWVPZigpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHNlbGYuZm9yRWFjaChmdW5jdGlvbiAodmFsdWUsIGtleSkge1xyXG4gICAgICAgICAgICBzZWxmW2tleV0gPSBjYWxsYmFja2ZuKHZhbHVlLCBrZXksIHNlbGYpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBzZWxmO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgaWYgKCEkKSB7XHJcbiAgICAgICAgT2JqZWN0LnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gKGNhbGxiYWNrZm4pIHtcclxuICAgICAgICAgICAgZm9yICh2YXIga2V5IGluIHRoaXMpIHtcclxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdgdmFsdWVgOicsIHRoaXNba2V5XSk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnYGtleWA6Jywga2V5KTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdgdGhpc2A6JywgdGhpcyk7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFja2ZuKHRoaXNba2V5XSwga2V5LCB0aGlzKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcbiAgICB9Ly8qL1xyXG59KSgpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIFN0cmluZy5wcm90b3R5cGUudWNmaXJzdCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy52YWx1ZU9mKCkucmVwbGFjZSgvXihbYS16XSkvLCBmdW5jdGlvbiAoZykgeyByZXR1cm4gZy50b1VwcGVyQ2FzZSgpOyB9KTsgICAgXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBTdHJpbmcucHJvdG90eXBlLnVuZGVyc2NvcmVUb0h1bWFuID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnZhbHVlT2YoKVxyXG4gICAgICAgICAgICAgICAgLy8gcmVwbGFjZSB1bmRlcnNjb3JlXHJcbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvXyhcXHcpL2csIGZ1bmN0aW9uIChnKSB7IHJldHVybiBcIiBcIiArIGdbMV0udG9VcHBlckNhc2UoKTsgfSkudWNmaXJzdCgpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICB9O1xyXG59KSgpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcbiAgICAvKipcbiAgICAgKiBcbiAgICAgKiBAdHlwZSBTdHJpbmdqUXVlcnkgdXRpbGl0aWVzIHNvIHdlIGNhbiBydW4gaW4gYnJvd3NlciBhbmQgb24gc2VydmVyIHdpdGhvdXQgYnJvd3NlcmlmeVxuICAgICAqL1xuICAgIFxuICAgIHZhciB2ZXJzaW9uID0gXCIyLjIuMFwiO1xuICAgIFxuICAgIHZhciBhcnIgPSBbXTtcbiAgICBcbiAgICB2YXIgc2xpY2UgPSBhcnIuc2xpY2U7XG5cbiAgICB2YXIgY29uY2F0ID0gYXJyLmNvbmNhdDtcblxuICAgIHZhciBwdXNoID0gYXJyLnB1c2g7XG5cbiAgICB2YXIgaW5kZXhPZiA9IGFyci5pbmRleE9mO1xuXG4gICAgdmFyIGNsYXNzMnR5cGUgPSB7fTtcblxuICAgIHZhciB0b1N0cmluZyA9IGNsYXNzMnR5cGUudG9TdHJpbmc7XG5cbiAgICB2YXIgaGFzT3duID0gY2xhc3MydHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuICAgIHZhciBzdXBwb3J0ID0ge307XG4gICAgXG4gICAgdmFyIHNvcnRPcmRlciA9IGZ1bmN0aW9uKCBhLCBiICkge1xuXHRcdGlmICggYSA9PT0gYiApIHtcblx0XHRcdGhhc0R1cGxpY2F0ZSA9IHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiAwO1xuXHR9XG4gICAgXG4gICAgZnVuY3Rpb24gaXNBcnJheUxpa2UoIG9iaiApIHtcbiAgICAgICAgICAgIC8vIFN1cHBvcnQ6IGlPUyA4LjIgKG5vdCByZXByb2R1Y2libGUgaW4gc2ltdWxhdG9yKVxuICAgICAgICAgICAgLy8gYGluYCBjaGVjayB1c2VkIHRvIHByZXZlbnQgSklUIGVycm9yIChnaC0yMTQ1KVxuICAgICAgICAgICAgLy8gaGFzT3duIGlzbid0IHVzZWQgaGVyZSBkdWUgdG8gZmFsc2UgbmVnYXRpdmVzXG4gICAgICAgICAgICAvLyByZWdhcmRpbmcgTm9kZWxpc3QgbGVuZ3RoIGluIElFXG4gICAgICAgICAgICB2YXIgbGVuZ3RoID0gISFvYmogJiYgXCJsZW5ndGhcIiBpbiBvYmogJiYgb2JqLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA9IGpRdWVyeS50eXBlKCBvYmogKTtcblxuICAgICAgICAgICAgaWYgKCB0eXBlID09PSBcImZ1bmN0aW9uXCIgfHwgalF1ZXJ5LmlzV2luZG93KCBvYmogKSApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdHlwZSA9PT0gXCJhcnJheVwiIHx8IGxlbmd0aCA9PT0gMCB8fFxuICAgICAgICAgICAgICAgICAgICB0eXBlb2YgbGVuZ3RoID09PSBcIm51bWJlclwiICYmIGxlbmd0aCA+IDAgJiYgKCBsZW5ndGggLSAxICkgaW4gb2JqO1xuICAgIH0gICBcbiAgICBcbiAgICB2YXIgalF1ZXJ5ID0ge1xuICAgICAgICAvLyBVbmlxdWUgZm9yIGVhY2ggY29weSBvZiBqUXVlcnkgb24gdGhlIHBhZ2Vcblx0ZXhwYW5kbzogXCJqUXVlcnlcIiArICggdmVyc2lvbiArIE1hdGgucmFuZG9tKCkgKS5yZXBsYWNlKCAvXFxEL2csIFwiXCIgKSxcblxuXHQvLyBBc3N1bWUgalF1ZXJ5IGlzIHJlYWR5IHdpdGhvdXQgdGhlIHJlYWR5IG1vZHVsZVxuXHRpc1JlYWR5OiB0cnVlLFxuXG5cdGVycm9yOiBmdW5jdGlvbiggbXNnICkge1xuXHRcdHRocm93IG5ldyBFcnJvciggbXNnICk7XG5cdH0sXG5cblx0bm9vcDogZnVuY3Rpb24oKSB7fSxcblxuXHRpc0Z1bmN0aW9uOiBmdW5jdGlvbiggb2JqICkge1xuXHRcdHJldHVybiBqUXVlcnkudHlwZSggb2JqICkgPT09IFwiZnVuY3Rpb25cIjtcblx0fSxcblxuXHRpc0FycmF5OiBBcnJheS5pc0FycmF5LFxuXG5cdGlzV2luZG93OiBmdW5jdGlvbiggb2JqICkge1xuXHRcdHJldHVybiBvYmogIT0gbnVsbCAmJiBvYmogPT09IG9iai53aW5kb3c7XG5cdH0sXG5cblx0aXNOdW1lcmljOiBmdW5jdGlvbiggb2JqICkge1xuXG5cdFx0Ly8gcGFyc2VGbG9hdCBOYU5zIG51bWVyaWMtY2FzdCBmYWxzZSBwb3NpdGl2ZXMgKG51bGx8dHJ1ZXxmYWxzZXxcIlwiKVxuXHRcdC8vIC4uLmJ1dCBtaXNpbnRlcnByZXRzIGxlYWRpbmctbnVtYmVyIHN0cmluZ3MsIHBhcnRpY3VsYXJseSBoZXggbGl0ZXJhbHMgKFwiMHguLi5cIilcblx0XHQvLyBzdWJ0cmFjdGlvbiBmb3JjZXMgaW5maW5pdGllcyB0byBOYU5cblx0XHQvLyBhZGRpbmcgMSBjb3JyZWN0cyBsb3NzIG9mIHByZWNpc2lvbiBmcm9tIHBhcnNlRmxvYXQgKCMxNTEwMClcblx0XHR2YXIgcmVhbFN0cmluZ09iaiA9IG9iaiAmJiBvYmoudG9TdHJpbmcoKTtcblx0XHRyZXR1cm4gIWpRdWVyeS5pc0FycmF5KCBvYmogKSAmJiAoIHJlYWxTdHJpbmdPYmogLSBwYXJzZUZsb2F0KCByZWFsU3RyaW5nT2JqICkgKyAxICkgPj0gMDtcblx0fSxcblxuXHRpc1BsYWluT2JqZWN0OiBmdW5jdGlvbiggb2JqICkge1xuXG5cdFx0Ly8gTm90IHBsYWluIG9iamVjdHM6XG5cdFx0Ly8gLSBBbnkgb2JqZWN0IG9yIHZhbHVlIHdob3NlIGludGVybmFsIFtbQ2xhc3NdXSBwcm9wZXJ0eSBpcyBub3QgXCJbb2JqZWN0IE9iamVjdF1cIlxuXHRcdC8vIC0gRE9NIG5vZGVzXG5cdFx0Ly8gLSB3aW5kb3dcblx0XHRpZiAoIGpRdWVyeS50eXBlKCBvYmogKSAhPT0gXCJvYmplY3RcIiB8fCBvYmoubm9kZVR5cGUgfHwgalF1ZXJ5LmlzV2luZG93KCBvYmogKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIG9iai5jb25zdHJ1Y3RvciAmJlxuXHRcdFx0XHQhaGFzT3duLmNhbGwoIG9iai5jb25zdHJ1Y3Rvci5wcm90b3R5cGUsIFwiaXNQcm90b3R5cGVPZlwiICkgKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIGZ1bmN0aW9uIGhhc24ndCByZXR1cm5lZCBhbHJlYWR5LCB3ZSdyZSBjb25maWRlbnQgdGhhdFxuXHRcdC8vIHxvYmp8IGlzIGEgcGxhaW4gb2JqZWN0LCBjcmVhdGVkIGJ5IHt9IG9yIGNvbnN0cnVjdGVkIHdpdGggbmV3IE9iamVjdFxuXHRcdHJldHVybiB0cnVlO1xuXHR9LFxuXG5cdGlzRW1wdHlPYmplY3Q6IGZ1bmN0aW9uKCBvYmogKSB7XG5cdFx0dmFyIG5hbWU7XG5cdFx0Zm9yICggbmFtZSBpbiBvYmogKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9LFxuXG5cdHR5cGU6IGZ1bmN0aW9uKCBvYmogKSB7XG5cdFx0aWYgKCBvYmogPT0gbnVsbCApIHtcblx0XHRcdHJldHVybiBvYmogKyBcIlwiO1xuXHRcdH1cblxuXHRcdC8vIFN1cHBvcnQ6IEFuZHJvaWQ8NC4wLCBpT1M8NiAoZnVuY3Rpb25pc2ggUmVnRXhwKVxuXHRcdHJldHVybiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiBvYmogPT09IFwiZnVuY3Rpb25cIiA/XG5cdFx0XHRjbGFzczJ0eXBlWyB0b1N0cmluZy5jYWxsKCBvYmogKSBdIHx8IFwib2JqZWN0XCIgOlxuXHRcdFx0dHlwZW9mIG9iajtcblx0fSxcblxuXHQvLyBFdmFsdWF0ZXMgYSBzY3JpcHQgaW4gYSBnbG9iYWwgY29udGV4dFxuXHRnbG9iYWxFdmFsOiBmdW5jdGlvbiggY29kZSApIHtcblx0XHR2YXIgc2NyaXB0LFxuXHRcdFx0aW5kaXJlY3QgPSBldmFsO1xuXG5cdFx0Y29kZSA9IGpRdWVyeS50cmltKCBjb2RlICk7XG5cblx0XHRpZiAoIGNvZGUgKSB7XG5cblx0XHRcdC8vIElmIHRoZSBjb2RlIGluY2x1ZGVzIGEgdmFsaWQsIHByb2xvZ3VlIHBvc2l0aW9uXG5cdFx0XHQvLyBzdHJpY3QgbW9kZSBwcmFnbWEsIGV4ZWN1dGUgY29kZSBieSBpbmplY3RpbmcgYVxuXHRcdFx0Ly8gc2NyaXB0IHRhZyBpbnRvIHRoZSBkb2N1bWVudC5cblx0XHRcdGlmICggY29kZS5pbmRleE9mKCBcInVzZSBzdHJpY3RcIiApID09PSAxICkge1xuXHRcdFx0XHRzY3JpcHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCBcInNjcmlwdFwiICk7XG5cdFx0XHRcdHNjcmlwdC50ZXh0ID0gY29kZTtcblx0XHRcdFx0ZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZCggc2NyaXB0ICkucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCggc2NyaXB0ICk7XG5cdFx0XHR9IGVsc2Uge1xuXG5cdFx0XHRcdC8vIE90aGVyd2lzZSwgYXZvaWQgdGhlIERPTSBub2RlIGNyZWF0aW9uLCBpbnNlcnRpb25cblx0XHRcdFx0Ly8gYW5kIHJlbW92YWwgYnkgdXNpbmcgYW4gaW5kaXJlY3QgZ2xvYmFsIGV2YWxcblxuXHRcdFx0XHRpbmRpcmVjdCggY29kZSApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcblxuXHQvLyBDb252ZXJ0IGRhc2hlZCB0byBjYW1lbENhc2U7IHVzZWQgYnkgdGhlIGNzcyBhbmQgZGF0YSBtb2R1bGVzXG5cdC8vIFN1cHBvcnQ6IElFOS0xMStcblx0Ly8gTWljcm9zb2Z0IGZvcmdvdCB0byBodW1wIHRoZWlyIHZlbmRvciBwcmVmaXggKCM5NTcyKVxuXHRjYW1lbENhc2U6IGZ1bmN0aW9uKCBzdHJpbmcgKSB7XG5cdFx0cmV0dXJuIHN0cmluZy5yZXBsYWNlKCBybXNQcmVmaXgsIFwibXMtXCIgKS5yZXBsYWNlKCByZGFzaEFscGhhLCBmY2FtZWxDYXNlICk7XG5cdH0sXG5cblx0bm9kZU5hbWU6IGZ1bmN0aW9uKCBlbGVtLCBuYW1lICkge1xuXHRcdHJldHVybiBlbGVtLm5vZGVOYW1lICYmIGVsZW0ubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PT0gbmFtZS50b0xvd2VyQ2FzZSgpO1xuXHR9LFxuXG5cdGVhY2g6IGZ1bmN0aW9uKCBvYmosIGNhbGxiYWNrICkge1xuXHRcdHZhciBsZW5ndGgsIGkgPSAwO1xuXG5cdFx0aWYgKCBpc0FycmF5TGlrZSggb2JqICkgKSB7XG5cdFx0XHRsZW5ndGggPSBvYmoubGVuZ3RoO1xuXHRcdFx0Zm9yICggOyBpIDwgbGVuZ3RoOyBpKysgKSB7XG5cdFx0XHRcdGlmICggY2FsbGJhY2suY2FsbCggb2JqWyBpIF0sIGksIG9ialsgaSBdICkgPT09IGZhbHNlICkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvciAoIGkgaW4gb2JqICkge1xuXHRcdFx0XHRpZiAoIGNhbGxiYWNrLmNhbGwoIG9ialsgaSBdLCBpLCBvYmpbIGkgXSApID09PSBmYWxzZSApIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBvYmo7XG5cdH0sXG5cblx0Ly8gU3VwcG9ydDogQW5kcm9pZDw0LjFcblx0dHJpbTogZnVuY3Rpb24oIHRleHQgKSB7XG5cdFx0cmV0dXJuIHRleHQgPT0gbnVsbCA/XG5cdFx0XHRcIlwiIDpcblx0XHRcdCggdGV4dCArIFwiXCIgKS5yZXBsYWNlKCBydHJpbSwgXCJcIiApO1xuXHR9LFxuXG5cdC8vIHJlc3VsdHMgaXMgZm9yIGludGVybmFsIHVzYWdlIG9ubHlcblx0bWFrZUFycmF5OiBmdW5jdGlvbiggYXJyLCByZXN1bHRzICkge1xuXHRcdHZhciByZXQgPSByZXN1bHRzIHx8IFtdO1xuXG5cdFx0aWYgKCBhcnIgIT0gbnVsbCApIHtcblx0XHRcdGlmICggaXNBcnJheUxpa2UoIE9iamVjdCggYXJyICkgKSApIHtcblx0XHRcdFx0alF1ZXJ5Lm1lcmdlKCByZXQsXG5cdFx0XHRcdFx0dHlwZW9mIGFyciA9PT0gXCJzdHJpbmdcIiA/XG5cdFx0XHRcdFx0WyBhcnIgXSA6IGFyclxuXHRcdFx0XHQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHVzaC5jYWxsKCByZXQsIGFyciApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiByZXQ7XG5cdH0sXG5cblx0aW5BcnJheTogZnVuY3Rpb24oIGVsZW0sIGFyciwgaSApIHtcblx0XHRyZXR1cm4gYXJyID09IG51bGwgPyAtMSA6IGluZGV4T2YuY2FsbCggYXJyLCBlbGVtLCBpICk7XG5cdH0sXG5cblx0bWVyZ2U6IGZ1bmN0aW9uKCBmaXJzdCwgc2Vjb25kICkge1xuXHRcdHZhciBsZW4gPSArc2Vjb25kLmxlbmd0aCxcblx0XHRcdGogPSAwLFxuXHRcdFx0aSA9IGZpcnN0Lmxlbmd0aDtcblxuXHRcdGZvciAoIDsgaiA8IGxlbjsgaisrICkge1xuXHRcdFx0Zmlyc3RbIGkrKyBdID0gc2Vjb25kWyBqIF07XG5cdFx0fVxuXG5cdFx0Zmlyc3QubGVuZ3RoID0gaTtcblxuXHRcdHJldHVybiBmaXJzdDtcblx0fSxcblxuXHRncmVwOiBmdW5jdGlvbiggZWxlbXMsIGNhbGxiYWNrLCBpbnZlcnQgKSB7XG5cdFx0dmFyIGNhbGxiYWNrSW52ZXJzZSxcblx0XHRcdG1hdGNoZXMgPSBbXSxcblx0XHRcdGkgPSAwLFxuXHRcdFx0bGVuZ3RoID0gZWxlbXMubGVuZ3RoLFxuXHRcdFx0Y2FsbGJhY2tFeHBlY3QgPSAhaW52ZXJ0O1xuXG5cdFx0Ly8gR28gdGhyb3VnaCB0aGUgYXJyYXksIG9ubHkgc2F2aW5nIHRoZSBpdGVtc1xuXHRcdC8vIHRoYXQgcGFzcyB0aGUgdmFsaWRhdG9yIGZ1bmN0aW9uXG5cdFx0Zm9yICggOyBpIDwgbGVuZ3RoOyBpKysgKSB7XG5cdFx0XHRjYWxsYmFja0ludmVyc2UgPSAhY2FsbGJhY2soIGVsZW1zWyBpIF0sIGkgKTtcblx0XHRcdGlmICggY2FsbGJhY2tJbnZlcnNlICE9PSBjYWxsYmFja0V4cGVjdCApIHtcblx0XHRcdFx0bWF0Y2hlcy5wdXNoKCBlbGVtc1sgaSBdICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1hdGNoZXM7XG5cdH0sXG5cblx0Ly8gYXJnIGlzIGZvciBpbnRlcm5hbCB1c2FnZSBvbmx5XG5cdG1hcDogZnVuY3Rpb24oIGVsZW1zLCBjYWxsYmFjaywgYXJnICkge1xuXHRcdHZhciBsZW5ndGgsIHZhbHVlLFxuXHRcdFx0aSA9IDAsXG5cdFx0XHRyZXQgPSBbXTtcblxuXHRcdC8vIEdvIHRocm91Z2ggdGhlIGFycmF5LCB0cmFuc2xhdGluZyBlYWNoIG9mIHRoZSBpdGVtcyB0byB0aGVpciBuZXcgdmFsdWVzXG5cdFx0aWYgKCBpc0FycmF5TGlrZSggZWxlbXMgKSApIHtcblx0XHRcdGxlbmd0aCA9IGVsZW1zLmxlbmd0aDtcblx0XHRcdGZvciAoIDsgaSA8IGxlbmd0aDsgaSsrICkge1xuXHRcdFx0XHR2YWx1ZSA9IGNhbGxiYWNrKCBlbGVtc1sgaSBdLCBpLCBhcmcgKTtcblxuXHRcdFx0XHRpZiAoIHZhbHVlICE9IG51bGwgKSB7XG5cdFx0XHRcdFx0cmV0LnB1c2goIHZhbHVlICk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdC8vIEdvIHRocm91Z2ggZXZlcnkga2V5IG9uIHRoZSBvYmplY3QsXG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvciAoIGkgaW4gZWxlbXMgKSB7XG5cdFx0XHRcdHZhbHVlID0gY2FsbGJhY2soIGVsZW1zWyBpIF0sIGksIGFyZyApO1xuXG5cdFx0XHRcdGlmICggdmFsdWUgIT0gbnVsbCApIHtcblx0XHRcdFx0XHRyZXQucHVzaCggdmFsdWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZsYXR0ZW4gYW55IG5lc3RlZCBhcnJheXNcblx0XHRyZXR1cm4gY29uY2F0LmFwcGx5KCBbXSwgcmV0ICk7XG5cdH0sXG5cblx0Ly8gQSBnbG9iYWwgR1VJRCBjb3VudGVyIGZvciBvYmplY3RzXG5cdGd1aWQ6IDEsXG5cblx0Ly8gQmluZCBhIGZ1bmN0aW9uIHRvIGEgY29udGV4dCwgb3B0aW9uYWxseSBwYXJ0aWFsbHkgYXBwbHlpbmcgYW55XG5cdC8vIGFyZ3VtZW50cy5cblx0cHJveHk6IGZ1bmN0aW9uKCBmbiwgY29udGV4dCApIHtcblx0XHR2YXIgdG1wLCBhcmdzLCBwcm94eTtcblxuXHRcdGlmICggdHlwZW9mIGNvbnRleHQgPT09IFwic3RyaW5nXCIgKSB7XG5cdFx0XHR0bXAgPSBmblsgY29udGV4dCBdO1xuXHRcdFx0Y29udGV4dCA9IGZuO1xuXHRcdFx0Zm4gPSB0bXA7XG5cdFx0fVxuXG5cdFx0Ly8gUXVpY2sgY2hlY2sgdG8gZGV0ZXJtaW5lIGlmIHRhcmdldCBpcyBjYWxsYWJsZSwgaW4gdGhlIHNwZWNcblx0XHQvLyB0aGlzIHRocm93cyBhIFR5cGVFcnJvciwgYnV0IHdlIHdpbGwganVzdCByZXR1cm4gdW5kZWZpbmVkLlxuXHRcdGlmICggIWpRdWVyeS5pc0Z1bmN0aW9uKCBmbiApICkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBTaW11bGF0ZWQgYmluZFxuXHRcdGFyZ3MgPSBzbGljZS5jYWxsKCBhcmd1bWVudHMsIDIgKTtcblx0XHRwcm94eSA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGZuLmFwcGx5KCBjb250ZXh0IHx8IHRoaXMsIGFyZ3MuY29uY2F0KCBzbGljZS5jYWxsKCBhcmd1bWVudHMgKSApICk7XG5cdFx0fTtcblxuXHRcdC8vIFNldCB0aGUgZ3VpZCBvZiB1bmlxdWUgaGFuZGxlciB0byB0aGUgc2FtZSBvZiBvcmlnaW5hbCBoYW5kbGVyLCBzbyBpdCBjYW4gYmUgcmVtb3ZlZFxuXHRcdHByb3h5Lmd1aWQgPSBmbi5ndWlkID0gZm4uZ3VpZCB8fCBqUXVlcnkuZ3VpZCsrO1xuXG5cdFx0cmV0dXJuIHByb3h5O1xuXHR9LFxuXG5cdG5vdzogRGF0ZS5ub3csXG5cblx0Ly8galF1ZXJ5LnN1cHBvcnQgaXMgbm90IHVzZWQgaW4gQ29yZSBidXQgb3RoZXIgcHJvamVjdHMgYXR0YWNoIHRoZWlyXG5cdC8vIHByb3BlcnRpZXMgdG8gaXQgc28gaXQgbmVlZHMgdG8gZXhpc3QuXG5cdHN1cHBvcnQ6IHN1cHBvcnQsXG4gICAgICAgIHVuaXF1ZTogZnVuY3Rpb24oIHJlc3VsdHMgKSB7XG4gICAgICAgICAgICB2YXIgZWxlbSxcbiAgICAgICAgICAgICAgICAgICAgZHVwbGljYXRlcyA9IFtdLFxuICAgICAgICAgICAgICAgICAgICBqID0gMCxcbiAgICAgICAgICAgICAgICAgICAgaSA9IDA7XG5cbiAgICAgICAgICAgIC8vIFVubGVzcyB3ZSAqa25vdyogd2UgY2FuIGRldGVjdCBkdXBsaWNhdGVzLCBhc3N1bWUgdGhlaXIgcHJlc2VuY2VcbiAgICAgICAgICAgIGhhc0R1cGxpY2F0ZSA9ICFzdXBwb3J0LmRldGVjdER1cGxpY2F0ZXM7XG4gICAgICAgICAgICBzb3J0SW5wdXQgPSAhc3VwcG9ydC5zb3J0U3RhYmxlICYmIHJlc3VsdHMuc2xpY2UoIDAgKTtcbiAgICAgICAgICAgIHJlc3VsdHMuc29ydCggc29ydE9yZGVyICk7XG5cbiAgICAgICAgICAgIGlmICggaGFzRHVwbGljYXRlICkge1xuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoIChlbGVtID0gcmVzdWx0c1tpKytdKSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIGVsZW0gPT09IHJlc3VsdHNbIGkgXSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGogPSBkdXBsaWNhdGVzLnB1c2goIGkgKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgd2hpbGUgKCBqLS0gKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5zcGxpY2UoIGR1cGxpY2F0ZXNbIGogXSwgMSApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIENsZWFyIGlucHV0IGFmdGVyIHNvcnRpbmcgdG8gcmVsZWFzZSBvYmplY3RzXG4gICAgICAgICAgICAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL2pxdWVyeS9zaXp6bGUvcHVsbC8yMjVcbiAgICAgICAgICAgIHNvcnRJbnB1dCA9IG51bGw7XG5cbiAgICAgICAgICAgIHJldHVybiByZXN1bHRzO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBcbiAgICB2YXIgJDtcbiAgICBpZiAod2luZG93ID09PSBfX3VuZGVmaW5lZCB8fCB3aW5kb3cualF1ZXJ5ID09PSBfX3VuZGVmaW5lZCkge1xuICAgICAgICAkID0galF1ZXJ5O1xuICAgIH0gZWxzZSB7XG4gICAgICAgICQgPSB3aW5kb3cualF1ZXJ5O1xuICAgIH1cbiAgICBcbiAgICBtb2R1bGUuZXhwb3J0cyA9ICQ7XG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi9Nb2QnKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgdmFyIE1FVEFfTU9EUyA9IHJlcXVpcmUoJy4vbWV0YV9tb2RzJyk7XHJcbiAgICBcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBBcHBsaWNhYmxlIGV4dGVuZHMgTW9kIGltcGxpZW1lbnRzIEFwcGxpY2FibGUsIFNlcmlhbGl6ZWFibGVcclxuICAgICAqL1xyXG4gICAgdmFyIEFwcGxpY2FibGVNb2QgPSBNb2QuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcHJvcHMgZm9yIEdncGtFbnRyeVxyXG4gICAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKHByb3BzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEFwcGxpY2FibGVcclxuICAgICAgICAgICAgdGhpcy5yZXNldEFwcGxpY2FibGUoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFwcGxpY2FibGUgbG9naWNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3NcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBpZiBhcHBsaWNhYmxlXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVzZXRcclxuICAgICAgICAgICAgdGhpcy5yZXNldEFwcGxpY2FibGUoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghaXRlbS5pbkRvbWFpbk9mKCt0aGlzLmdldFByb3AoXCJEb21haW5cIikpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5XUk9OR19ET01BSU47XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIWl0ZW0uaGFzUm9vbUZvcih0aGlzKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuRE9NQUlOX0ZVTEw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCt0aGlzLmdldFByb3AoXCJMZXZlbFwiKSA+IGl0ZW0uaXRlbV9sZXZlbCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuTE9XRVJfSUxWTDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGNvcnJlY3RfZ3JvdXBzID0gJC5tYXAoaXRlbS5tb2RzLCBmdW5jdGlvbiAobW9kKSB7IFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5nZXRQcm9wKFwiQ29ycmVjdEdyb3VwXCIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChjb3JyZWN0X2dyb3Vwcy5pbmRleE9mKHRoaXMuZ2V0UHJvcChcIkNvcnJlY3RHcm91cFwiKSkgIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5BTFJFQURZX1BSRVNFTlQ7XHJcbiAgICAgICAgICAgIH0gXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoK3RoaXMuZ2V0UHJvcChcIkxldmVsXCIpID4gMjggJiYgaXRlbS5pbk1vZHMoTUVUQV9NT0RTLkxMRF9NT0QpICE9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuQUJPVkVfTExEX0xFVkVMO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7IUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgQXBwbGljYWJsZS5TVUNDRVNTKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlc2V0QXBwbGljYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURSwgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXCJSb2xsYWJsZU1vZC5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBmb3IgU2VyaWFsaXplYWJsZS5kZXNlcmlhbGl6ZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNlcmlhbGl6ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAga2xhc3M6IFwiQXBwbGljYWJsZU1vZFwiLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW3RoaXMucHJvcHNdLFxyXG4gICAgICAgICAgICAgICAgY29uc3RydWN0b3I6IEFwcGxpY2FibGVNb2RcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UHJvcChcIk5hbWVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByb2xsYWJsZUNhY2hlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5hcHBsaWNhYmxlQ2FjaGVkKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIFVOU0NBTk5FRDogMCwgLy8gcGVyIGNvbnZlbnRpb24gXHJcbiAgICAgICAgU1VDQ0VTUzogMSwgXHJcbiAgICAgICAgLy8gQXBwbGljYWJsZVxyXG4gICAgICAgIERPTUFJTl9GVUxMOiAyLFxyXG4gICAgICAgIEFMUkVBRFlfUFJFU0VOVDogNCxcclxuICAgICAgICBXUk9OR19ET01BSU46IDgsXHJcbiAgICAgICAgTE9XRVJfSUxWTDogMTYsXHJcbiAgICAgICAgQUJPVkVfTExEX0xFVkVMOiAzMlxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBBcHBsaWNhYmxlTW9kO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQXBwbGljYWJsZU1vZCA9IHJlcXVpcmUoJy4vQXBwbGljYWJsZU1vZCcpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICB2YXIgR2dwa0VudHJ5ID0gcmVxdWlyZSgnLi4vR2dwa0VudHJ5Jyk7XHJcbiAgICBcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBNYXN0ZXJNb2QgZXh0ZW5kcyBBcHBsaWNhYmxlTW9kXHJcbiAgICAgKiBcclxuICAgICAqIG1vZCBmcm9tIGEgbWFzdGVyYmVuY2hcclxuICAgICAqL1xyXG4gICAgdmFyIE1hc3Rlck1vZCA9IEFwcGxpY2FibGVNb2QuZXh0ZW5kKHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAobW9kX3Byb3BzLCBiZW5jaF9wcm9wcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihtb2RfcHJvcHMpO1xyXG5cclxuICAgICAgICAgICAgdGhpcy5iZW5jaCA9IG5ldyBHZ3BrRW50cnkoYmVuY2hfcHJvcHMpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbW9kbmFtZSB3aXRoIGJhc2ljIHN0YXRzXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldFByb3AoXCJOYW1lXCIpICsgXHJcbiAgICAgICAgICAgICAgICAgICAgXCIoXCIgKyB0aGlzLmJlbmNoLmdldFByb3AoXCJNYXN0ZXJOYW1lU2hvcnRcIikgKyBcIiBMZXZlbDogXCIgKyB0aGlzLmJlbmNoLmdldFByb3AoXCJNYXN0ZXJMZXZlbFwiKSArIFwiKVwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYXBwbGljYWJsZSBsb2dpY1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHZhciBiYXNlX2l0ZW1fY2xhc3NlcztcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgYmFzZV9pdGVtX2NsYXNzZXMgPSB0aGlzLmJlbmNoLnZhbHVlQXNBcnJheShcIkJhc2VJdGVtQ2xhc3Nlc0tleXNcIik7XHJcbiAgICAgICAgICAgIGlmIChiYXNlX2l0ZW1fY2xhc3Nlcy5sZW5ndGggPiAwICYmIGJhc2VfaXRlbV9jbGFzc2VzLmluZGV4T2YoK2l0ZW0uZW50cnkuZ2V0UHJvcChcIkl0ZW1DbGFzc1wiKSkgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBNYXN0ZXJNb2QuQVBQTElDQUJMRV9CWVRFLldST05HX0lURU1DTEFTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZ3JlcCBNYXN0ZXJNb2RzIGFuZCBzZXQgZmFpbHVyZSBpZiB3ZSBjYW50IG11bHRpbW9kXHJcbiAgICAgICAgICAgIGlmICgkLmdyZXAoaXRlbS5tb2RzLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kIGluc3RhbmNlb2YgTWFzdGVyTW9kO1xyXG4gICAgICAgICAgICB9KS5sZW5ndGggPiAwICYmIGl0ZW0uaW5Nb2RzKE1hc3Rlck1vZC5NRVRBTU9ELk1VTFRJTU9EKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IE1hc3Rlck1vZC5BUFBMSUNBQkxFX0JZVEUuTk9fTVVMVElNT0Q7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIEJpdCBmcm9tIHN1cGVyIGlmIGFkZGl0aW9uYWwgZmFpbHVyZSBiaXRzIHNldFxyXG4gICAgICAgICAgICBpZiAoKHRoaXMuYXBwbGljYWJsZV9ieXRlICYgQXBwbGljYWJsZS5TVUNDRVNTKSAmJiAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPiBBcHBsaWNhYmxlLlNVQ0NFU1MpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIF49IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZXJpYWxpemU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGtsYXNzOiBcIk1hc3Rlck1vZFwiLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW3RoaXMucHJvcHMsIHRoaXMuYmVuY2gucHJvcHNdLFxyXG4gICAgICAgICAgICAgICAgY29uc3RydWN0b3I6IE1hc3Rlck1vZFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBNYXN0ZXJNb2QuQVBQTElDQUJMRV9CWVRFLCBNYXN0ZXJNb2QuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFwiTWFzdGVyTW9kLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgTWFzdGVyTW9kLkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBBcHBsaWNhYmxlTW9kXHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLCAvLyBwZXIgY29udmVudGlvbiBcclxuICAgICAgICBTVUNDRVNTOiAxLCBcclxuICAgICAgICBET01BSU5fRlVMTDogMixcclxuICAgICAgICBBTFJFQURZX1BSRVNFTlQ6IDQsXHJcbiAgICAgICAgV1JPTkdfRE9NQUlOOiA4LFxyXG4gICAgICAgIExPV0VSX0lMVkw6IDE2LFxyXG4gICAgICAgIEFCT1ZFX0xMRF9MRVZFTDogMzIsXHJcbiAgICAgICAgLy8gTWFzdGVyTW9kXHJcbiAgICAgICAgV1JPTkdfSVRFTUNMQVNTOiA2NCxcclxuICAgICAgICBOT19NVUxUSU1PRDogMTI4XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBNYXN0ZXJNb2QuTUVUQU1PRCA9IHJlcXVpcmUoJy4vbWV0YV9tb2RzJyk7XHJcbiAgICBcclxuICAgIC8vIHRhYmxlIGBjcmFmdGluZ2JlbmNob3B0aW9uc2BcclxuICAgIE1hc3Rlck1vZC5jcmFmdGluZ2JlbmNob3B0aW9ucyA9IG51bGw7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTWFzdGVyTW9kO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHJlcXVpcmUoJy4uL2NvbmNlcm5zL0FycmF5Jyk7XHJcbiAgICBcclxuICAgIHZhciBHZ3BrRW50cnkgPSByZXF1aXJlKCcuLi9HZ3BrRW50cnknKTtcclxuICAgIHZhciBTdGF0ID0gcmVxdWlyZSgnLi4vU3RhdCcpO1xyXG4gICAgdmFyIFZhbHVlUmFuZ2UgPSByZXF1aXJlKCcuLi9WYWx1ZVJhbmdlJyk7XHJcbiAgICBcclxuICAgIGlmICgkID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogZXh0ZW5kcyBHZ3BrRW50cnkgaW1wbGVtZW50cyBMb2NhbGl6ZWFibGVcclxuICAgICAqL1xyXG4gICAgdmFyIE1vZCA9IEdncGtFbnRyeS5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChwcm9wcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihwcm9wcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc1ByZWZpeDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc1R5cGUoXCJwcmVmaXhcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc1N1ZmZpeDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc1R5cGUoXCJzdWZmaXhcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc1ByZW1hZGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNUeXBlKFwicHJlbWFkZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzVHlwZTogZnVuY3Rpb24gKHR5cGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuICt0aGlzLmdldFByb3AoXCJHZW5lcmF0aW9uVHlwZVwiKSA9PT0gTW9kLk1PRF9UWVBFW3R5cGUudG9VcHBlckNhc2UoKV07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0FmZml4OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzUHJlZml4KCkgfHwgdGhpcy5pc1N1ZmZpeCgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaW1wbGljaXRDYW5kaWRhdGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNQcmVtYWRlKCkgXHJcbiAgICAgICAgICAgICAgICAgICAgfHwgdGhpcy5pc1R5cGUoXCJ2YWFsXCIpIFxyXG4gICAgICAgICAgICAgICAgICAgIHx8IHRoaXMuaXNUeXBlKFwiZW5jaGFudG1lbnRcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXk8U3RhdD59IGFsbCBzdGF0cyBmcm9tIHRoaXMgbW9kXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc3RhdHNKb2luZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICByZXR1cm4gJC5tYXAodGhpcy52YWx1ZUFzQXJyYXkoXCJTdGF0c1wiKSwgZnVuY3Rpb24gKHJvdywgaSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHJvdy50b1N0cmluZygpLnRvTG93ZXJDYXNlKCkgPT09ICdudWxsJykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbnRpbnVlXHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHZhciBzdGF0ID0gbmV3IFN0YXQoTW9kLmFsbF9zdGF0c1tyb3ddKTtcclxuICAgICAgICAgICAgICAgIHN0YXQudmFsdWVzID0gbmV3IFZhbHVlUmFuZ2UoK3RoYXQuZ2V0UHJvcChcIlN0YXRcIiArIChpICsgMSkgKyBcIk1pblwiKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgK3RoYXQuZ2V0UHJvcChcIlN0YXRcIiArIChpICsgMSkgKyBcIk1heFwiKSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBzdGF0O1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHRyYW5zbGF0ZXMgdGhlIHN0YXRzXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICB0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciBzdGF0cyA9IHRoaXMuc3RhdHNKb2luZWQoKTtcclxuICAgICAgICAgICAgLy8gVE9ETyBtYXliZSBjaGVjayBiZWZvcmUgbG9jYWxpemluZyBjYXVzZSB1bmlxdWUgb24gbG9uZyBzdHJpbmdzIG1pZ2h0XHJcbiAgICAgICAgICAgIC8vIGJlIGluZWZmaWNpZW50LiBvbiB0aGUgb3RoZXIgaGFuZCB3ZSBhbG1vc3QgYWx3YXlzIGhhbmRsZSA8IDEwIG1vZHNcclxuICAgICAgICAgICAgcmV0dXJuICQudW5pcXVlKCQubWFwKHN0YXRzLCBmdW5jdGlvbiAoc3RhdCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHN0YXQudmFsdWVzLmlzWmVybygpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdC50KHN0YXRzLCBNb2QubG9jYWxpemF0aW9uKTtcclxuICAgICAgICAgICAgfSkpLmpvaW4oXCJcXG5cIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiB0cmFuc2xhdGVzIHRoZSBjb3JyZWN0IGdyb3VwXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBjb3JyZWN0R3JvdXBUcmFuc2xhdGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciBjb3JyZWN0X2dyb3VwID0gdGhpcy5nZXRQcm9wKFwiQ29ycmVjdEdyb3VwXCIpO1xyXG4gICAgICAgICAgICB2YXIgdHJhbnNsYXRlZCA9IE1vZC5jb3JyZWN0X2dyb3VwX2xvY2FsaXphdGlvbltjb3JyZWN0X2dyb3VwXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0cmFuc2xhdGVkID09PSBfX3VuZGVmaW5lZCB8fCB0cmFuc2xhdGVkID09PSBcIlwiKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBEZUNhbWVsaXplXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY29ycmVjdF9ncm91cFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpbnNlcnQgYSBzcGFjZSBiZWZvcmUgYWxsIGNhcHNcclxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyhbQS1aXSkvZywgJyAkMScpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gdHJhbnNsYXRlZDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHN0cmluZyBpZGVudGlmaWVyIG9mIHRoZSBnZW5lcmF0aW9uIHR5cGVcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZFR5cGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICByZXR1cm4gJC5tYXAoTW9kLk1PRF9UWVBFLCBmdW5jdGlvbiAobW9kX3R5cGUsIHR5cGVfbmFtZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKG1vZF90eXBlID09PSArdGhhdC5nZXRQcm9wKFwiR2VuZXJhdGlvblR5cGVcIikpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHlwZV9uYW1lLnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KVswXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UHJvcChcIk5hbWVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiB1bmlxdWUgaWQgZm9yIGRvbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZG9tSWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIE1vZC5kb21JZCh0aGlzLmdldFByb3AoXCJSb3dzXCIpKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgTW9kLmRvbUlkID0gZnVuY3Rpb24gKGlkKSB7XHJcbiAgICAgICAgcmV0dXJuIFwibW9kX1wiICsgaWQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBNb2QuTU9EX1RZUEUgPSB7XHJcbiAgICAgICAgUFJFRklYOiAxLFxyXG4gICAgICAgIFNVRkZJWDogMixcclxuICAgICAgICBQUkVNQURFOiAzLFxyXG4gICAgICAgIE5FTUVTSVM6IDQsXHJcbiAgICAgICAgVkFBTDogNSxcclxuICAgICAgICBCTE9PRExJTkVTOiA2LFxyXG4gICAgICAgIFRPUk1FTlQ6IDcsXHJcbiAgICAgICAgVEVNUEVTVDogOCxcclxuICAgICAgICBUQUxJU01BTjogOSxcclxuICAgICAgICBFTkNIQU5UTUVOVDogMTBcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1vZC5ET01BSU4gPSB7XHJcbiAgICAgICAgSVRFTTogMSxcclxuICAgICAgICBGTEFTSzogMixcclxuICAgICAgICBNT05TVEVSOiAzLFxyXG4gICAgICAgIFNUUk9OR0JPWDogNCxcclxuICAgICAgICBNQVA6IDUsXHJcbiAgICAgICAgU1RBTkNFOiA5LFxyXG4gICAgICAgIE1BU1RFUjogMTAsXHJcbiAgICAgICAgSkVXRUw6IDExXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBNb2QubG9jYWxpemF0aW9uID0gbnVsbDtcclxuICAgIE1vZC5jb3JyZWN0X2dyb3VwX2xvY2FsaXphdGlvbiA9IG51bGw7XHJcbiAgICBNb2QuYWxsX3N0YXRzID0gbnVsbDtcclxuICAgIFxyXG4gICAgLy8gdGFibGUgYG1vZHNgXHJcbiAgICB0aGlzLm1vZHMgPSBudWxsO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZDtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgdmFyIFNlcmlhbGl6ZWFibGUgPSByZXF1aXJlKCcuLi9TZXJpYWxpemVhYmxlJyk7XHJcbiAgICBcclxuICAgIHZhciBNb2RGYWN0b3J5ID0gQ2xhc3MuZXh0ZW5kKHt9KTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBAc2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvMzM2MjQ3MS9ob3ctY2FuLWktY2FsbC1hLWphdmFzY3JpcHQtY29uc3RydWN0b3ItdXNpbmctY2FsbC1vci1hcHBseVxyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHNlcmlhbGl6ZWRcclxuICAgICAqIEByZXR1cm5zIHtNb2RGYWN0b3J5X0wxLk1vZEZhY3RvcnkuZGVzZXJpYWxpemUuRmFjdG9yeUZ1bmN0aW9ufVxyXG4gICAgICovXHJcbiAgICBNb2RGYWN0b3J5LmRlc2VyaWFsaXplID0gU2VyaWFsaXplYWJsZS5kZXNlcmlhbGl6ZTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNb2RGYWN0b3J5O1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQXBwbGljYWJsZU1vZCA9IHJlcXVpcmUoJy4vQXBwbGljYWJsZU1vZCcpO1xyXG4gICAgdmFyIFNwYXduYWJsZSA9IHJlcXVpcmUoJy4uL1NwYXduYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgUm9sbGFibGVNb2QgZXh0ZW5kcyBBcHBsaWNhYmxlTW9kIGltcGxpZW1lbnRzIFNwYXduYWJsZVxyXG4gICAgICovXHJcbiAgICB2YXIgUm9sbGFibGVNb2QgPSBBcHBsaWNhYmxlTW9kLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IHByb3BzIGZvciBHZ3BrRW50cnlcclxuICAgICAgICAgKiBAcmV0dXJucyB7dW5kZWZpbmVkfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChwcm9wcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihwcm9wcyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBTcGF3bmFibGVcclxuICAgICAgICAgICAgdGhpcy5yZXNldFNwYXduYWJsZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5yb2xsYWJsZSA9IFJvbGxhYmxlTW9kLlVOU0NBTk5FRDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCeXRlU2V0Lmh1bWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgUm9sbGFibGVNb2QuQVBQTElDQUJMRV9CWVRFLCBSb2xsYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXCJSb2xsYWJsZU1vZC5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBjaGVja3MgaWYgc3Bhd25hYmxlIGFuZCBzZXRzIHRoZSBzcGF3bndlaWdodFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kQ29udGFpbmVyfSBtb2RfY29udGFpbmVyXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHNwYXduYWJsZU9uOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lciwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBTcGF3bmFibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gU3Bhd25hYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBzcGF3bndlaWdodF90YWdzID0gJCh0aGlzLnZhbHVlQXNBcnJheShcIlNwYXduV2VpZ2h0X1RhZ3NLZXlzXCIpKS5maWx0ZXIobW9kX2NvbnRhaW5lci5nZXRUYWdzKCkpLnRvQXJyYXkoKTtcclxuICAgICAgICAgICAgLy8gcmVzZXRcclxuICAgICAgICAgICAgdGhpcy5yZXNldFNwYXduYWJsZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHNwYXdud2VpZ2h0X3RhZ3MubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNwYXduYWJsZV9ieXRlID0gUm9sbGFibGVNb2QuU1BBV05BQkxFX0JZVEUuTk9fTUFUQ0hJTkdfVEFHUztcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gZmlyc3Qgc3Bhd253ZWlnaHRfdGFnIHRvICBtYXRjaCBhbnkgaXRlbV90YWcgZ2V0cyB0byBjaG9vc2VcclxuICAgICAgICAgICAgLy8gdGhlIHNwYXdud2VpZ2h0XHJcbiAgICAgICAgICAgIHRoaXMuc3Bhd253ZWlnaHQgPSB0aGlzLnZhbHVlQXNBcnJheShcIlNwYXduV2VpZ2h0X1ZhbHVlc1wiKVt0aGlzLnZhbHVlQXNBcnJheShcIlNwYXduV2VpZ2h0X1RhZ3NLZXlzXCIpLmluZGV4T2Yoc3Bhd253ZWlnaHRfdGFnc1swXSldO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3Bhd253ZWlnaHQgPD0gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zcGF3bndlaWdodCA9IDA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNwYXduYWJsZV9ieXRlIHw9IFJvbGxhYmxlTW9kLlNQQVdOQUJMRV9CWVRFLlNQQVdOV0VJR0hUX1pFUk87XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5zcGF3bmFibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zcGF3bmFibGVfYnl0ZSA9IFNwYXduYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuc3Bhd25hYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc3Bhd25jaGFuY2UgaW4gWyVdXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IHByZWNpc2lvblxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaHVtYW5TcGF3bmNoYW5jZTogZnVuY3Rpb24gKHByZWNpc2lvbikge1xyXG4gICAgICAgICAgICBpZiAocHJlY2lzaW9uID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgcHJlY2lzaW9uID0gMjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHNwYXduY2hhbmNlID0gMC4wO1xyXG5cclxuICAgICAgICAgICAgLy8gc3Bhd25jaGFuY2UgaXMgYmFzaWNhbGx5IHplcm8gaWYgaXRzIG5vdCBhcHBsaWNhYmxlXHJcbiAgICAgICAgICAgIGlmICh0aGlzLnNwYXduY2hhbmNlICE9PSBudWxsICYmIHRoaXMuYXBwbGljYWJsZUNhY2hlZCgpKSB7XHJcbiAgICAgICAgICAgICAgICBzcGF3bmNoYW5jZSA9IHRoaXMuc3Bhd25jaGFuY2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiAoc3Bhd25jaGFuY2UgKiAxMDApLnRvRml4ZWQocHJlY2lzaW9uKSArIFwiJVwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVzZXRTcGF3bmFibGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy5zcGF3bndlaWdodCA9IDA7XHJcbiAgICAgICAgICAgIHRoaXMuc3Bhd25jaGFuY2UgPSBudWxsO1xyXG4gICAgICAgICAgICB0aGlzLnNwYXduYWJsZV9ieXRlID0gU3Bhd25hYmxlLlVOU0NBTk5FRDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNwYXduYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuc3Bhd25hYmxlX2J5dGUsIFJvbGxhYmxlTW9kLlNQQVdOQUJMRV9CWVRFLCBSb2xsYWJsZU1vZC5TUEFXTkFCTEVfQllURS5TVUNDRVNTLCBcIlJvbGxhYmxlTW9kLnNwYXduYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3Bhd25hYmxlQ2FjaGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5zcGF3bmFibGVfYnl0ZSwgU3Bhd25hYmxlLlNVQ0NFU1MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcm9sbGFibGVPbjogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICAgICAgdGhpcy5yb2xsYWJsZSA9IHRoaXMuYXBwbGljYWJsZVRvKG1vZF9jb250YWluZXIpICYmIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zcGF3bmFibGVPbihtb2RfY29udGFpbmVyKSA7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5yb2xsYWJsZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGZvciBTZXJpYWxpemVhYmxlLmRlc2VyaWFsaXplXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2VyaWFsaXplOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBrbGFzczogXCJSb2xsYWJsZU1vZFwiLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW3RoaXMucHJvcHNdLFxyXG4gICAgICAgICAgICAgICAgY29uc3RydWN0b3I6IFJvbGxhYmxlTW9kXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuICAgICAgICByb2xsYWJsZUNhY2hlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zcGF3bmFibGVDYWNoZWQoKSAmJiB0aGlzLmFwcGxpY2FibGVDYWNoZWQoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgUm9sbGFibGVNb2QuU1BBV05BQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLCAvLyBwZXIgY29udmVudGlvbiBcclxuICAgICAgICBTVUNDRVNTOiAxLFxyXG4gICAgICAgIE5PX01BVENISU5HX1RBR1M6IDIsXHJcbiAgICAgICAgU1BBV05XRUlHSFRfWkVSTzogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgUm9sbGFibGVNb2QuQVBQTElDQUJMRV9CWVRFID0gQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEU7XHJcbiAgICBcclxuICAgIFJvbGxhYmxlTW9kLlVOU0NBTk5FRCA9IDA7XHJcbiAgICBSb2xsYWJsZU1vZC5TVUNDRVNTID0gdHJ1ZTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBSb2xsYWJsZU1vZDtcclxufSkuY2FsbCh0aGlzKTsiLCIvKlxuICogY29sbGVjdGlvbiBvZiBtZXRhbW9kcyB0aGF0IGFmZmVjdCB0aGUgY3JhZnRpbmcgcHJvY2Vzc1xuICovXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIFxuICAgIG1vZHVsZS5leHBvcnRzID0ge1xuICAgICAgICBMT0NLRURfUFJFRklYRVM6IDQzNDEsXG4gICAgICAgIExPQ0tFRF9TVUZGSVhFUzogNDM0MixcbiAgICAgICAgTk9fQVRUQUNLX01PRFM6IDQzNDMsXG4gICAgICAgIE5PX0NBU1RFUl9NT0RTOiA0MzQ0LFxuICAgICAgICBNVUxUSU1PRDogNDM0NSxcbiAgICAgICAgTExEX01PRDogNDI4OFxuICAgIH07XG59KS5jYWxsKHRoaXMpOyJdfQ==
