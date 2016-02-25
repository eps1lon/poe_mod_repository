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
},{"../Applicable":2,"../ModContainers/Item":10,"../ModGenerators/ModGeneratorFactory":23,"../concerns/ByteSet":35,"../jquery/jquery_node":40,"../mods/RollableMod":45,"./ModGenerator":22}],18:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9ndWkuanMiLCJqcy9saWJzL0FwcGxpY2FibGUuanMiLCJqcy9saWJzL0RhdGFEZXBlbmRlbmN5LmpzIiwianMvbGlicy9FeGNlcHRpb25zL05vdEZvdW5kRXhjZXB0aW9uLmpzIiwianMvbGlicy9HZ3BrRW50cnkuanMiLCJqcy9saWJzL0hhc2hiYW5nLmpzIiwianMvbGlicy9Jbmhlcml0YW5jZS5qcyIsImpzL2xpYnMvTG9jYWxpemF0aW9uLmpzIiwianMvbGlicy9NZXRhRGF0YS5qcyIsImpzL2xpYnMvTW9kQ29udGFpbmVycy9JdGVtLmpzIiwianMvbGlicy9Nb2RDb250YWluZXJzL0l0ZW1JbXBsaWNpdHMuanMiLCJqcy9saWJzL01vZENvbnRhaW5lcnMvTW9kQ29udGFpbmVyLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0FsY2hlbXkuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvQWx0ZXJhdGlvbi5qcyIsImpzL2xpYnMvTW9kR2VuZXJhdG9ycy9BdWdtZW50LmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0NoYW9zLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0N1cnJlbmN5LmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL0VuY2hhbnRtZW50YmVuY2guanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvRXhhbHRlZC5qcyIsImpzL2xpYnMvTW9kR2VuZXJhdG9ycy9JdGVtU2hvd2Nhc2UuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvTWFzdGVyYmVuY2guanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvTW9kR2VuZXJhdG9yLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL01vZEdlbmVyYXRvckZhY3RvcnkuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvUmVnYWwuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvU2NvdXJpbmcuanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvVGFsaXNtYW4uanMiLCJqcy9saWJzL01vZEdlbmVyYXRvcnMvVHJhbnNtdXRlLmpzIiwianMvbGlicy9Nb2RHZW5lcmF0b3JzL1ZhYWwuanMiLCJqcy9saWJzL1BhdGguanMiLCJqcy9saWJzL1NlcmlhbGl6ZWFibGUuanMiLCJqcy9saWJzL1NwYXduYWJsZS5qcyIsImpzL2xpYnMvU3RhdC5qcyIsImpzL2xpYnMvVmFsdWVSYW5nZS5qcyIsImpzL2xpYnMvY29uY2VybnMvQXJyYXkuanMiLCJqcy9saWJzL2NvbmNlcm5zL0J5dGVTZXQuanMiLCJqcy9saWJzL2NvbmNlcm5zL01hdGguanMiLCJqcy9saWJzL2NvbmNlcm5zL051bWJlci5qcyIsImpzL2xpYnMvY29uY2VybnMvT2JqZWN0LmpzIiwianMvbGlicy9jb25jZXJucy9TdHJpbmcuanMiLCJqcy9saWJzL2pxdWVyeS9qcXVlcnlfbm9kZS5qcyIsImpzL2xpYnMvbW9kcy9BcHBsaWNhYmxlTW9kLmpzIiwianMvbGlicy9tb2RzL01hc3Rlck1vZC5qcyIsImpzL2xpYnMvbW9kcy9Nb2QuanMiLCJqcy9saWJzL21vZHMvTW9kRmFjdG9yeS5qcyIsImpzL2xpYnMvbW9kcy9Sb2xsYWJsZU1vZC5qcyIsImpzL2xpYnMvbW9kcy9tZXRhX21vZHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzd6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdktBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNVZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuLyohXHJcbiAqIFBvRSBNb2QgUmVwb3NpdG9yeVxyXG4gKiBCeSBTZWJhc3RpYW4gU2lsYmVybWFublxyXG4gKiBNSVQgTGljZW5zZWQuXHJcbiAqL1xyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICBpZiAod2luZG93ID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJuZWVkIHdpbmRvdyBjb250ZXh0XCIpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy9ub2RlXHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yRmFjdG9yeSA9IHJlcXVpcmUoJy4vbGlicy9Nb2RHZW5lcmF0b3JzL01vZEdlbmVyYXRvckZhY3RvcnknKTtcclxuICAgIHZhciBNb2RHZW5lcmF0b3IgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL01vZEdlbmVyYXRvcnMvTW9kR2VuZXJhdG9yJyk7XHJcbiAgICB2YXIgTWFzdGVyYmVuY2ggICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9Nb2RHZW5lcmF0b3JzL01hc3RlcmJlbmNoJyk7XHJcbiAgICB2YXIgSXRlbSAgICAgICAgICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBNb2QgICAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL21vZHMvTW9kJyk7XHJcbiAgICB2YXIgTW9kRmFjdG9yeSAgICAgICAgICA9IHJlcXVpcmUoJy4vbGlicy9tb2RzL01vZEZhY3RvcnknKTtcclxuICAgIHZhciBBcHBsaWNhYmxlTW9kICAgICAgID0gcmVxdWlyZSgnLi9saWJzL21vZHMvQXBwbGljYWJsZU1vZCcpO1xyXG4gICAgdmFyIE1hc3Rlck1vZCAgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvbW9kcy9NYXN0ZXJNb2QnKTtcclxuICAgIHZhciBTcGF3bmFibGUgICAgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL1NwYXduYWJsZScpO1xyXG4gICAgdmFyIERhdGFEZXBlbmRlbmN5ICAgICAgPSByZXF1aXJlKCcuL2xpYnMvRGF0YURlcGVuZGVuY3knKTtcclxuICAgIHZhciBMb2NhbGl6YXRpb24gICAgICAgID0gcmVxdWlyZSgnLi9saWJzL0xvY2FsaXphdGlvbicpO1xyXG4gICAgdmFyIEhhc2hiYW5nICAgICAgICAgICAgPSByZXF1aXJlKCcuL2xpYnMvSGFzaGJhbmcnKTtcclxuICAgIHZhciBCeXRlU2V0ICAgICAgICAgICAgID0gcmVxdWlyZSgnLi9saWJzL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIHZhciBOb3RGb3VuZEV4Y2VwdGlvbiAgID0gcmVxdWlyZSgnLi9saWJzL0V4Y2VwdGlvbnMvTm90Rm91bmRFeGNlcHRpb24nKTtcclxuICAgIFxyXG4gICAgcmVxdWlyZSgnLi9saWJzL2NvbmNlcm5zL0FycmF5Jyk7XHJcbiAgICByZXF1aXJlKCcuL2xpYnMvY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgcmVxdWlyZSgnLi9saWJzL2NvbmNlcm5zL01hdGgnKTtcclxuICAgIHJlcXVpcmUoJy4vbGlicy9jb25jZXJucy9OdW1iZXInKTtcclxuICAgIHJlcXVpcmUoJy4vbGlicy9jb25jZXJucy9PYmplY3QnKTtcclxuICAgIHJlcXVpcmUoJy4vbGlicy9jb25jZXJucy9TdHJpbmcnKTtcclxuICAgIFxyXG4gICAgLy8gXCJ0YWJsZXNcIlxyXG4gICAgdmFyIG1vZHMgPSBbXSxcclxuICAgICAgICB0YWdzID0gW10sXHJcbiAgICAgICAgYmFzZWl0ZW10eXBlcyA9IFtdLFxyXG4gICAgICAgIHN0YXRzID0gW107XHJcbiAgICBcclxuICAgIHZhciBUQUdTID0ge307XHJcbiAgICBcclxuICAgIC8vIHRlbXBsYXRlIG1ldGhvZHNcclxuICAgIHZhciBjcmVhdGVfZnJvbV90ZW1wbGF0ZSA9IGZ1bmN0aW9uIChzZWxlY3RvciwgY29udGV4dCkge1xyXG4gICAgICAgIGlmIChjb250ZXh0ICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgc2VsZWN0b3IgPSBjb250ZXh0LnNlbGVjdG9yICsgXCIgXCIgKyBzZWxlY3RvcjtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuICQoc2VsZWN0b3IgKyBcIi50ZW1wbGF0ZVwiKS5jbG9uZSh0cnVlKS5yZW1vdmVDbGFzcyhcInRlbXBsYXRlXCIpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gYXNzZXJ0IGJhc2VpdGVtIHR5cGVvZiBCYXNlSXRlbVxyXG4gICAgdmFyIGRpc3BsYXlfYmFzZWl0ZW0gPSBmdW5jdGlvbiAoYmFzZWl0ZW0sIHNlbGVjdG9yKSB7XHJcbiAgICAgICAgLy8gYXNzZXJ0IGJhc2VpdGVtIHR5cGVvZiBCYXNlSXRlbVxyXG4gICAgICAgIC8vIHJlbW92ZSBvbGQgaXRlbWJveFxyXG4gICAgICAgICQoc2VsZWN0b3IpLmVtcHR5KCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCEoYmFzZWl0ZW0gaW5zdGFuY2VvZiBJdGVtKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciAkaXRlbWJveCA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwiLml0ZW1ib3hcIik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gcmFyaXR5XHJcbiAgICAgICAgdmFyIHJhcml0eV9pZGVudCA9IGJhc2VpdGVtLnJhcml0eUlkZW50KCk7XHJcbiAgICAgICAgJGl0ZW1ib3guYWRkQ2xhc3MocmFyaXR5X2lkZW50KTtcclxuICAgICAgICAkKFwiI2l0ZW1fcmFyaXRpZXMgb3B0aW9uW3ZhbHVlPSdcIiArIHJhcml0eV9pZGVudC50b1VwcGVyQ2FzZSgpICsgXCInXVwiKS5wcm9wKFwic2VsZWN0ZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyICRzdGF0c2dyb3VwX3RlbXBsYXRlID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCIuaXRlbWJveC1zdGF0c2dyb3VwXCIsICRpdGVtYm94KTtcclxuICAgICAgICB2YXIgJHN0YXRzZ3JvdXAgPSAkc3RhdHNncm91cF90ZW1wbGF0ZS5jbG9uZSh0cnVlKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBuYW1lXHJcbiAgICAgICAgJChcIi5pdGVtYm94aGVhZGVyIC5pdGVtTmFtZVwiLCAkaXRlbWJveCkudGV4dChiYXNlaXRlbS5pdGVtTmFtZSgpKTtcclxuICAgICAgICAkKFwiLml0ZW1ib3hoZWFkZXIgLmJhc2VOYW1lXCIsICRpdGVtYm94KS50ZXh0KGJhc2VpdGVtLmJhc2VOYW1lKCkpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGl0ZW1fY2xhc3NcclxuICAgICAgICAkc3RhdHNncm91cC5hZGRDbGFzcyhcIm1ldGFfZGF0YVwiKTtcclxuICAgICAgICAkc3RhdHNncm91cC5hcHBlbmQoYmFzZWl0ZW0uaXRlbWNsYXNzSWRlbnQoKS50b0xvd2VyQ2FzZSgpLnVjZmlyc3QoKSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gdGFnc1xyXG4gICAgICAgICRzdGF0c2dyb3VwLmFwcGVuZChcIjxicj5cIiwgJC5tYXAoYmFzZWl0ZW0uZ2V0VGFnc1dpdGhQcm9wcyh0YWdzKSwgZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwcm9wcy5JZC51bmRlcnNjb3JlVG9IdW1hbigpO1xyXG4gICAgICAgIH0pLmpvaW4oXCIsIFwiKSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gc2VwXHJcbiAgICAgICAgJChcIi5pdGVtYm94LXN0YXRzXCIsICRpdGVtYm94KS5hcHBlbmQoJHN0YXRzZ3JvdXApO1xyXG4gICAgICAgICRzdGF0c2dyb3VwID0gJHN0YXRzZ3JvdXBfdGVtcGxhdGUuY2xvbmUodHJ1ZSk7XHJcbiAgICAgICAgJHN0YXRzZ3JvdXAuYWRkQ2xhc3MoXCJsb2NhbFN0YXRzXCIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHN0YXRzXHJcbiAgICAgICAgJC5lYWNoKGJhc2VpdGVtLmxvY2FsU3RhdHMoKSwgZnVuY3Rpb24gKHN0YXRfZGVzYywgdmFsdWUpIHtcclxuICAgICAgICAgICAgJHN0YXRzZ3JvdXAuYXBwZW5kKFwiPGJyPlwiLCBzdGF0X2Rlc2MsIFwiOiBcIiwgXCI8c3BhbiBjbGFzcz0ndGV4dC12YWx1ZSc+XCIgKyB2YWx1ZSArIFwiPC9zcGFuPlwiKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBzZXBcclxuICAgICAgICBpZiAoJC50cmltKCRzdGF0c2dyb3VwLnRleHQoKSkubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICQoXCIuaXRlbWJveC1zdGF0c1wiLCAkaXRlbWJveCkuYXBwZW5kKCRzdGF0c2dyb3VwKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgJHN0YXRzZ3JvdXAgPSAkc3RhdHNncm91cF90ZW1wbGF0ZS5jbG9uZSh0cnVlKTtcclxuICAgICAgICAkc3RhdHNncm91cC5hZGRDbGFzcyhcInJlcXVpcmVtZW50c1wiKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBSZXF1aXJlbWVudHNcclxuICAgICAgICAkc3RhdHNncm91cC5hcHBlbmQoXCJSZXF1aXJlcyBcIiwgJC5tYXAoYmFzZWl0ZW0ucmVxdWlyZW1lbnRzKCksIGZ1bmN0aW9uIChyZXF1aXJlbWVudCwga2V5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBrZXkgKyBcIiA8c3BhbiBjbGFzcz0ndGV4dC12YWx1ZSc+XCIgKyByZXF1aXJlbWVudCArIFwiPC9zcGFuPlwiO1xyXG4gICAgICAgIH0pLmpvaW4oXCIsIFwiKSwgXCI8YnI+XCIpO1xyXG4gICAgICAgIC8vIGlsdmxcclxuICAgICAgICAkc3RhdHNncm91cC5hcHBlbmQoY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCIuaWx2bFwiLCAkaXRlbWJveCkudmFsKGJhc2VpdGVtLml0ZW1fbGV2ZWwpKTtcclxuICAgICAgICBcclxuICAgICAgICAkLmVhY2goW1wiaW1wbGljaXRzXCIsIFwiYWZmaXhlc1wiXSwgZnVuY3Rpb24gKF8sIG1vZEdldHRlcikge1xyXG4gICAgICAgICAgICAvLyBzZXBcclxuICAgICAgICAgICAgaWYgKCQudHJpbSgkc3RhdHNncm91cC50ZXh0KCkpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgJChcIi5pdGVtYm94LXN0YXRzXCIsICRpdGVtYm94KS5hcHBlbmQoJHN0YXRzZ3JvdXApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkc3RhdHNncm91cCA9ICRzdGF0c2dyb3VwX3RlbXBsYXRlLmNsb25lKCk7XHJcbiAgICAgICAgICAgICRzdGF0c2dyb3VwLmFkZENsYXNzKG1vZEdldHRlcik7XHJcblxyXG4gICAgICAgICAgICB2YXIgJG1vZHMgPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcInVsLm1vZHNcIiwgJGl0ZW1ib3gpO1xyXG4gICAgICAgICAgICAkbW9kcy5hZGRDbGFzcyhtb2RHZXR0ZXIpO1xyXG5cclxuICAgICAgICAgICAgLy8gYWZmaXhlc1xyXG4gICAgICAgICAgICAkLmVhY2goYmFzZWl0ZW1bXCJnZXRcIiArIG1vZEdldHRlci51Y2ZpcnN0KCldKCksIGZ1bmN0aW9uIChpLCBtb2QpIHtcclxuICAgICAgICAgICAgICAgIHZhciAkbW9kID0gY3JlYXRlX2Zyb21fdGVtcGxhdGUoXCJsaS5tb2RcIiwgJG1vZHMpO1xyXG5cclxuICAgICAgICAgICAgICAgICRtb2QuZGF0YShcInByaW1hcnlcIiwgbW9kLmdldFByb3AoXCJSb3dzXCIpKTtcclxuICAgICAgICAgICAgICAgICRtb2QuYWRkQ2xhc3MoXCJtb2QtdHlwZS1cIiArIG1vZC5tb2RUeXBlKCkpO1xyXG4gICAgICAgICAgICAgICAgJG1vZC5hZGRDbGFzcyhtb2Quc2VyaWFsaXplKCkua2xhc3MpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAkKFwiLm5hbWVcIiwgJG1vZCkudGV4dChtb2QubmFtZSgpKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJC5lYWNoKG1vZC50KCkuc3BsaXQoXCJcXG5cIiksIGZ1bmN0aW9uIChqLCBzdGF0X3RleHQpIHtcclxuICAgICAgICAgICAgICAgICAgICAkKFwidWwuc3RhdHNcIiwgJG1vZCkuYXBwZW5kKFwiPGxpPlwiICsgc3RhdF90ZXh0ICsgXCI8L2xpPlwiKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICRtb2QuYXBwZW5kVG8oJG1vZHMpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGlmICgkKFwiLnN0YXRzIGxpXCIsICRtb2RzKS5sZW5ndGggPiAwIHx8IGZhbHNlKSB7XHJcbiAgICAgICAgICAgICAgICAkbW9kcy5hcHBlbmRUbygkc3RhdHNncm91cCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gc2VwXHJcbiAgICAgICAgaWYgKCQudHJpbSgkc3RhdHNncm91cC50ZXh0KCkpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAkKFwiLml0ZW1ib3gtc3RhdHNcIiwgJGl0ZW1ib3gpLmFwcGVuZCgkc3RhdHNncm91cCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vJChcIi5pdGVtYm94LXN0YXRzXCIsICRpdGVtYm94KS5hcHBlbmQoJHNlcGFyYXRvcl90ZW1wbGF0ZS5jbG9uZSgpKVxyXG4gICAgICAgIC8vJHN0YXRzZ3JvdXAgPSAkc3RhdHNncm91cF90ZW1wbGF0ZS5jbG9uZSgpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGFwcGVuZCBuZXcgb25lXHJcbiAgICAgICAgcmV0dXJuICQoXCIjdXNlZF9iYXNlaXRlbVwiKS5hcHBlbmQoJGl0ZW1ib3gpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdmFyIGRpc3BsYXlfYXZhaWxhYmxlX21vZHMgPSBmdW5jdGlvbiAobW9kX2dlbmVyYXRvciwgYmFzZWl0ZW0pIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhtb2RfZ2VuZXJhdG9yLCBcIkBcIiwgYmFzZWl0ZW0sIFwiP1wiKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBzaG93biBncm91cHNcclxuICAgICAgICB2YXIgJGNsaWNrZWRfZ3JvdXBzID0gJChcIiNhdmFpbGFibGVfbW9kcyB0Ym9keS5jbGlja2VkXCIpO1xyXG4gICAgICAgIHZhciB3YXNfZXhwYW5kZWQgPSAkKFwidGFibGUubW9kc1wiKS5oYXNDbGFzcyhcImV4cGFuZGVkXCIpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgLy8gZXh0ZW5kcyBNb2RHZW5lcmF0b3IgaW1wbGVtZW50cyBBcHBsaWNhYmxlXHJcbiAgICAgICAgaWYgKCEobW9kX2dlbmVyYXRvciBpbnN0YW5jZW9mIE1vZEdlbmVyYXRvcikpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJtb2RfZ2VuZXJhdG9yIG5lZWRzIHRvIGJlIG9mIHR5cGUgTW9kR2VuZXJhdG9yXCIpO1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIShiYXNlaXRlbSBpbnN0YW5jZW9mIEl0ZW0pKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiYmFzZWl0ZW0gbmVlZHMgdG8gYmUgb2YgdHlwZSBCYXNlSXRlbVwiKTtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBmaWx0ZXJcclxuICAgICAgICB2YXIgd2hpdGVsaXN0ID0gQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuTE9XRVJfSUxWTFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkRPTUFJTl9GVUxMXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHwgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuQUxSRUFEWV9QUkVTRU5UXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHwgTWFzdGVyTW9kLkFQUExJQ0FCTEVfQllURS5OT19NVUxUSU1PRFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB8IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkFCT1ZFX0xMRF9MRVZFTDtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgYXBwbGljYWJsZV9tb2RzID0gbW9kX2dlbmVyYXRvci5tb2RzKGJhc2VpdGVtLCB3aGl0ZWxpc3QpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIG1vZCBncm91cHNcclxuICAgICAgICB2YXIgcHJlZml4ZXMgPSBTcGF3bmFibGUuY2FsY3VsYXRlU3Bhd25jaGFuY2UoJC5ncmVwKGFwcGxpY2FibGVfbW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbW9kLmlzUHJlZml4KCk7XHJcbiAgICAgICAgfSksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1vZC5hcHBsaWNhYmxlQ2FjaGVkKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIHN1ZmZpeGVzID0gU3Bhd25hYmxlLmNhbGN1bGF0ZVNwYXduY2hhbmNlKCQuZ3JlcChhcHBsaWNhYmxlX21vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1vZC5pc1N1ZmZpeCgpO1xyXG4gICAgICAgIH0pLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2QuYXBwbGljYWJsZUNhY2hlZCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBpbXBsaWNpdHMgPSBTcGF3bmFibGUuY2FsY3VsYXRlU3Bhd25jaGFuY2UoJC5ncmVwKGFwcGxpY2FibGVfbW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbW9kLmltcGxpY2l0Q2FuZGlkYXRlKCk7XHJcbiAgICAgICAgfSksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG1vZC5hcHBsaWNhYmxlQ2FjaGVkKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcImltcGxpY2l0c1wiLCBpbXBsaWNpdHMpO1xyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCJwcmVmaXhlc1wiLCBwcmVmaXhlcyk7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcInN1ZmZpeFwiLCBzdWZmaXhlcyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZGlzcGxheSBwcmVmaXhlc1xyXG4gICAgICAgIGRpc3BsYXlfbW9kX2dyb3VwKHByZWZpeGVzLCAkKFwiI3ByZWZpeGVzXCIpLCB0cnVlKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBkaXNwbGF5IHN1ZmZpeGVzXHJcbiAgICAgICAgZGlzcGxheV9tb2RfZ3JvdXAoc3VmZml4ZXMsICQoXCIjc3VmZml4ZXNcIiksIHRydWUpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGRpc3BsYXkgaW1wbGljaXRzIFxyXG4gICAgICAgIGRpc3BsYXlfbW9kX2dyb3VwKGltcGxpY2l0cywgJChcIiNpbXBsaWNpdHNcIiksIGZhbHNlKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyByZW1vdmUgbm90X3JvbGxhYmxlIGNsYXNzIGlmIHJvbGxhYmxlXHJcbiAgICAgICAgJC5lYWNoKHByZWZpeGVzLmNvbmNhdChzdWZmaXhlcyksIGZ1bmN0aW9uIChpLCBtb2QpIHtcclxuICAgICAgICAgICAgaWYgKG1vZC5yb2xsYWJsZUNhY2hlZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAkKFwiI2NvcnJlY3QtZ3JvdXAtXCIgKyBtb2QuZ2V0UHJvcChcIkNvcnJlY3RHcm91cFwiKSkucmVtb3ZlQ2xhc3MoXCJub3Rfcm9sbGFibGVcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyByZXN0b3JlIHRvZ2dsZSBncm91cHNcclxuICAgICAgICAkY2xpY2tlZF9ncm91cHMuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQoXCIjXCIgKyAkKHRoaXMpLmF0dHIoXCJpZFwiKSkudHJpZ2dlcihcImNsaWNrXCIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIHdhcyBleHBhbmRlZD9cclxuICAgICAgICBpZiAod2FzX2V4cGFuZGVkKSB7XHJcbiAgICAgICAgICAgICQoXCIjZXhwYW5kX21vZHNcIikudHJpZ2dlcihcImNsaWNrXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge0FycmF5W01vZF19IG1vZHNcclxuICAgICAqIEBwYXJhbSB7alF1ZXJ5fSAkdGFibGUgdmlzdWFsIGNvbnRhaW5lclxyXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBncm91cGluZyB3ZXRoZXIgdG8gZ3JvdXAgbW9kcyBvZiBhIGdyb3VwIGludG8gdGJvZGllc1xyXG4gICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgKi9cclxuICAgIHZhciBkaXNwbGF5X21vZF9ncm91cCA9IGZ1bmN0aW9uIChtb2RzLCAkdGFibGUsIGdyb3VwaW5nKSB7XHJcbiAgICAgICAgLy8gZW1wdHkgbW9kc1xyXG4gICAgICAgIGlmIChncm91cGluZykge1xyXG4gICAgICAgICAgICAkKFwidGJvZHk6bm90KC50ZW1wbGF0ZSlcIiwgJHRhYmxlKS5yZW1vdmUoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAkKFwiLm1vZDpub3QoLnRlbXBsYXRlKVwiLCAkdGFibGUpLnJlbW92ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB2YXIgJG1vZF90ZW1wbGF0ZSA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwiLm1vZFwiLCAkdGFibGUpO1xyXG5cclxuICAgICAgICAvLyBkaXNwbGF5IGFmZml4ZXNcclxuICAgICAgICAkKFwiY2FwdGlvbiAuY291bnRcIiwgJHRhYmxlKS50ZXh0KG1vZHMubGVuZ3RoKTtcclxuICAgICAgICAkLmVhY2gobW9kcywgZnVuY3Rpb24gKF8sIG1vZCkge1xyXG4gICAgICAgICAgICB2YXIgJG1vZCA9ICRtb2RfdGVtcGxhdGUuY2xvbmUodHJ1ZSk7XHJcbiAgICAgICAgICAgIHZhciBzZXJpYWxpemVkID0gbW9kLnNlcmlhbGl6ZSgpO1xyXG4gICAgICAgICAgICB2YXIgdGl0bGUsIGNvcnJlY3RfZ3JvdXAsICRjb3JyZWN0X2dyb3VwO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJG1vZC5hdHRyKFwiaWRcIiwgbW9kLmRvbUlkKCkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZ3JvdXBpbmdcclxuICAgICAgICAgICAgaWYgKGdyb3VwaW5nKSB7XHJcbiAgICAgICAgICAgICAgICBjb3JyZWN0X2dyb3VwID0gbW9kLmdldFByb3AoXCJDb3JyZWN0R3JvdXBcIik7XHJcbiAgICAgICAgICAgICAgICAkY29ycmVjdF9ncm91cCA9ICQoXCJ0Ym9keS5tb2RzW2RhdGEtY29ycmVjdC1ncm91cD0nXCIgKyBjb3JyZWN0X2dyb3VwICsgXCInXVwiLCAkdGFibGUpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBuZXcgZ3JvdXA/XHJcbiAgICAgICAgICAgICAgICBpZiAoISRjb3JyZWN0X2dyb3VwLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciAkY29ycmVjdF9ncm91cF9oZWFkZXIgPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcInRib2R5LmNvcnJlY3RfZ3JvdXBcIiwgJHRhYmxlKTtcclxuICAgICAgICAgICAgICAgICAgICAkY29ycmVjdF9ncm91cCA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwidGJvZHkubW9kc1wiLCAkdGFibGUpLmhpZGUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gbWF5YmUgY2hhbmdlIGRvIGRhdGEoKSBhbmQgZmlsdGVyKClcclxuICAgICAgICAgICAgICAgICAgICAkY29ycmVjdF9ncm91cF9oZWFkZXIuYXR0cihcImlkXCIsIFwiY29ycmVjdC1ncm91cC1cIiArIGNvcnJlY3RfZ3JvdXApO1xyXG4gICAgICAgICAgICAgICAgICAgICRjb3JyZWN0X2dyb3VwLmF0dHIoXCJkYXRhLWNvcnJlY3QtZ3JvdXBcIiwgY29ycmVjdF9ncm91cCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICQoXCJ0aC5jb3JyZWN0X2dyb3VwXCIsICRjb3JyZWN0X2dyb3VwX2hlYWRlcikudGV4dChtb2QuY29ycmVjdEdyb3VwVHJhbnNsYXRlZCgpLnJlcGxhY2UoL1xcbi8sIFwiIC8gXCIpKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgJHRhYmxlLmFwcGVuZCgkY29ycmVjdF9ncm91cF9oZWFkZXIsICRjb3JyZWN0X2dyb3VwKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICRjb3JyZWN0X2dyb3VwID0gJChcInRib2R5XCIsICR0YWJsZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGVycm9yXHJcbiAgICAgICAgICAgIHZhciBhcHBsaWNhYmxlX2J5dGVfaHVtYW4gPSBtb2QuYXBwbGljYWJsZUJ5dGVIdW1hbigpO1xyXG4gICAgICAgICAgICAkbW9kLmF0dHIoXCJkYXRhLWFwcGxpY2FibGVfYnl0ZVwiLCBhcHBsaWNhYmxlX2J5dGVfaHVtYW4uYml0cy5qb2luKFwiLVwiKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgc3Bhd25hYmxlX2J5dGVfaHVtYW4gPSB7XHJcbiAgICAgICAgICAgICAgICBzdHJpbmdzOiBbXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBpZiAoU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgc3Bhd25hYmxlX2J5dGVfaHVtYW4gPSBtb2Quc3Bhd25hYmxlQnl0ZUh1bWFuKCk7XHJcbiAgICAgICAgICAgICAgICAkbW9kLmF0dHIoXCJkYXRhLXNwYXduYWJsZS1ieXRlXCIsIHNwYXduYWJsZV9ieXRlX2h1bWFuLmJpdHMuam9pbihcIi1cIikpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBjaGFuY2VcclxuICAgICAgICAgICAgICAgICQoXCIuc3Bhd25fY2hhbmNlXCIsICRtb2QpLnRleHQobW9kLmh1bWFuU3Bhd25jaGFuY2UoKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRpdGxlID0gYXBwbGljYWJsZV9ieXRlX2h1bWFuLnN0cmluZ3MuY29uY2F0KHNwYXduYWJsZV9ieXRlX2h1bWFuLnN0cmluZ3MpLmpvaW4oXCJgIGFuZCBgXCIpO1xyXG4gICAgICAgICAgICBpZiAodGl0bGUpIHtcclxuICAgICAgICAgICAgICAgICRtb2QucHJvcChcInRpdGxlXCIsIFwiYFwiICsgdGl0bGUgKyBcImBcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGlsdmxcclxuICAgICAgICAgICAgJChcIi5pbHZsXCIsICRtb2QpLnRleHQobW9kLmdldFByb3AoXCJMZXZlbFwiKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBuYW1lXHJcbiAgICAgICAgICAgICQoXCIubmFtZVwiLCAkbW9kKS50ZXh0KG1vZC5uYW1lKCkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gdmFsdWVcclxuICAgICAgICAgICAgJChcIi5zdGF0c1wiLCAkbW9kKS50ZXh0KG1vZC50KCkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gc2VyaWFsaXplXHJcbiAgICAgICAgICAgICRtb2QuZGF0YShcIm1vZFwiLCBzZXJpYWxpemVkKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHBvc3NpYmxlPyBUT0RPIGJldHRlciB3YXk/IG1heWJlIHNjYW4gYnl0ZVxyXG4gICAgICAgICAgICBpZiAodGl0bGUpIHtcclxuICAgICAgICAgICAgICAgICQoXCIuYWRkX21vZFwiLCAkbW9kKS5yZW1vdmUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gdmlzdWFsXHJcbiAgICAgICAgICAgICRtb2QuYWRkQ2xhc3Moc2VyaWFsaXplZC5rbGFzcyk7XHJcbiAgICAgICAgICAgICRtb2QuYWRkQ2xhc3MobW9kLm1vZFR5cGUoKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkY29ycmVjdF9ncm91cC5hcHBlbmQoJG1vZCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gbGV0IHRoZSBwbHVnaW4ga25vdyB0aGF0IHdlIG1hZGUgYSB1cGRhdGUgXHJcbiAgICAgICAgJHRhYmxlLnRyaWdnZXIoXCJ1cGRhdGVcIik7IFxyXG4gICAgICAgIC8vIHNvcnQgb24gaWx2bCBkZXNjXHJcbiAgICAgICAgJHRhYmxlLnRyaWdnZXIoXCJzb3J0b25cIixbW1swLDFdXV0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdmFyIGRpc3BsYXlfbW9kX2dlbl9hcHBsaWNhYmlsaXR5ID0gZnVuY3Rpb24gKGJhc2VpdGVtLCBhbGxfbW9kcykge1xyXG4gICAgICAgIGlmICghKGJhc2VpdGVtIGluc3RhbmNlb2YgSXRlbSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAkKFwidWwuY3VycmVuY2llcyAuYXBwbGljYWJsZSBpbnB1dC5Nb2RHZW5lcmF0b3I6cmFkaW9cIikuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciAkdGhpcyA9ICQodGhpcyk7XHJcbiAgICAgICAgICAgIHZhciAkYXBwbGljYWJsZSA9ICR0aGlzLnBhcmVudHMoXCIuYXBwbGljYWJsZVwiKTtcclxuICAgICAgICAgICAgdmFyIG1vZF9nZW5lcmF0b3IgPSBNb2RHZW5lcmF0b3JGYWN0b3J5LmJ1aWxkKCR0aGlzLnZhbCgpLCBhbGxfbW9kcyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkdGhpcy5wcm9wKFwiZGlzYWJsZWRcIiwgIW1vZF9nZW5lcmF0b3IuYXBwbGljYWJsZVRvKGJhc2VpdGVtKSk7XHJcbiAgICAgICAgICAgIHZhciBhcHBsaWNhYmxlX2J5dGUgPSBtb2RfZ2VuZXJhdG9yLmFwcGxpY2FibGVCeXRlSHVtYW4oKTtcclxuXHJcbiAgICAgICAgICAgICRhcHBsaWNhYmxlLmF0dHIoXCJ0aXRsZVwiLCBhcHBsaWNhYmxlX2J5dGUuc3RyaW5ncy5qb2luKFwiIGFuZCBcIikpO1xyXG4gICAgICAgICAgICAkYXBwbGljYWJsZS5hdHRyKFwiZGF0YS1hcHBsaWNhYmxlX2J5dGVcIiwgYXBwbGljYWJsZV9ieXRlLmJpdHMuam9pbihcIi1cIikpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgICAgICBcclxuICAgIC8vIGxvYWQgZGF0YVxyXG4gICAgJC53aGVuKFxyXG4gICAgICAgIG5ldyBEYXRhRGVwZW5kZW5jeShcImpzL2RhdGEvbW9kcy5qc29uXCIsIFwiI2RhdGFfbG9hZGVyX21vZHNcIikuZ2V0SlNPTihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICBtb2RzID0ganNvbjtcclxuICAgICAgICAgICAgTW9kLm1vZHMgPSBtb2RzO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG5ldyBEYXRhRGVwZW5kZW5jeShcImpzL2RhdGEvdGFncy5qc29uXCIsIFwiI2RhdGFfbG9hZGVyX3RhZ3NcIikuZ2V0SlNPTihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICB0YWdzID0ganNvbjtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICQodGFncykuZWFjaChmdW5jdGlvbiAoXywgdGFnKSB7XHJcbiAgICAgICAgICAgICAgICBUQUdTW3RhZy5JZC50b1VwcGVyQ2FzZSgpXSA9ICt0YWcuUm93cztcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSksXHJcbiAgICAgICAgbmV3IERhdGFEZXBlbmRlbmN5KFwianMvZGF0YS9iYXNlaXRlbXR5cGVzLmpzb25cIiwgXCIjZGF0YV9sb2FkZXJfYmFzZWl0ZW10eXBlc1wiKS5nZXRKU09OKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIGJhc2VpdGVtdHlwZXMgPSBqc29uO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG5ldyBEYXRhRGVwZW5kZW5jeShcImpzL2RhdGEvc3RhdHMuanNvblwiLCBcIiNkYXRhX2xvYWRlcl9zdGF0c1wiKS5nZXRKU09OKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIHN0YXRzID0ganNvbjtcclxuICAgICAgICAgICAgTW9kLmFsbF9zdGF0cyA9IHN0YXRzO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG5ldyBEYXRhRGVwZW5kZW5jeShcImpzL2RhdGEvdHJhbnNsYXRpb25zL0VuZ2xpc2gvc3RhdF9kZXNjcmlwdGlvbnMuanNvblwiLCBcIiNkYXRhX2xvYWRlcl9zdGF0X2Rlc2NcIikuZ2V0SlNPTihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICBNb2QubG9jYWxpemF0aW9uID0gbmV3IExvY2FsaXphdGlvbihqc29uKTtcclxuICAgICAgICB9KSxcclxuICAgICAgICBuZXcgRGF0YURlcGVuZGVuY3koXCJqcy9kYXRhL21ldGFfZGF0YS5qc29uXCIsIFwiI2RhdGFfbG9hZGVyX21ldGFfZGF0YVwiKS5nZXRKU09OKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIEl0ZW0ubWV0YV9kYXRhID0ganNvbjtcclxuICAgICAgICB9KSxcclxuICAgICAgICBuZXcgRGF0YURlcGVuZGVuY3koXCJqcy9kYXRhL2NyYWZ0aW5nYmVuY2hvcHRpb25zLmpzb25cIiwgXCIjZGF0YV9sb2FkZXJfY3JhZnRpbmdiZW5jaG9wdGlvbnNcIikuZ2V0SlNPTihmdW5jdGlvbiAoanNvbikge1xyXG4gICAgICAgICAgICBNYXN0ZXJNb2QuY3JhZnRpbmdiZW5jaG9wdGlvbnMgPSBqc29uO1xyXG4gICAgICAgIH0pLFxyXG4gICAgICAgIG5ldyBEYXRhRGVwZW5kZW5jeShcImpzL2RhdGEvdHJhbnNsYXRpb25zL0VuZ2xpc2gvbW9kX2NvcnJlY3RfZ3JvdXBzLmpzb25cIiwgXCIjZGF0YV9sb2FkZXJfbW9kX2NvcnJlY3RfZ3JvdXBzX2xvY1wiKS5nZXRKU09OKGZ1bmN0aW9uIChqc29uKSB7XHJcbiAgICAgICAgICAgIE1vZC5jb3JyZWN0X2dyb3VwX2xvY2FsaXphdGlvbiA9IGpzb247XHJcbiAgICAgICAgfSlcclxuICAgICkudGhlbihmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJsb2FkZWQgXCIgKyBtb2RzLmxlbmd0aCArIFwiIG1vZHNcIixcclxuICAgICAgICAgICAgICAgICAgICBcImxvYWRlZCBcIiArIHRhZ3MubGVuZ3RoICsgXCIgdGFnc1wiLFxyXG4gICAgICAgICAgICAgICAgICAgIFwibG9hZGVkIFwiICsgYmFzZWl0ZW10eXBlcy5sZW5ndGggKyBcIiBiYXNlaXRlbXR5cGVzXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgXCJsb2FkZWQgXCIgKyBzdGF0cy5sZW5ndGggKyBcIiBzdGF0c1wiKTsgXHJcblxyXG4gICAgICAgIC8vIHBlcnNpc3RlbmNlIHZhcnNcclxuICAgICAgICB2YXIgbW9kX2dlbmVyYXRvciA9IG51bGw7XHJcbiAgICAgICAgdmFyIGJhc2VpdGVtID0gbnVsbDtcclxuICAgICAgICBcclxuICAgICAgICAvLyBpdGVtIHNjcm9sbHMgZml4ZWRcclxuICAgICAgICB2YXIgaXRlbV9maXhlZF90b3A7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGdldF9zZWxlY3RlZF9tb2RfZ2VuZXJhdG9yID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgJG1vZF9nZW5lcmF0b3IgPSAkKFwiaW5wdXQuTW9kR2VuZXJhdG9yOnJhZGlvOmNoZWNrZWRcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoJG1vZF9nZW5lcmF0b3IuaGFzQ2xhc3MoXCJNYXN0ZXJiZW5jaFwiKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBNYXN0ZXJiZW5jaChtb2RzLCArJG1vZF9nZW5lcmF0b3IuZGF0YSgnbnBjX21hc3Rlcl9rZXknKSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTW9kR2VuZXJhdG9yRmFjdG9yeS5idWlsZCgkKFwiaW5wdXQuTW9kR2VuZXJhdG9yOnJhZGlvOmNoZWNrZWRcIikudmFsKCksIG1vZHMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBnZXQgbG9jYWxpemF0aW9uIGZvciBieXRlc2V0XHJcbiAgICAgICAgQnl0ZVNldC5pbml0TG9jYWxpemF0aW9uKCQoXCIjbGVnZW5kc1wiKSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgdmFyIGdldF9zZWxlY3RlZF9iYXNlaXRlbSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIGJhc2VpdGVtX2tleSA9ICQoXCIjYmFzZWl0ZW1zIG9wdGlvbjpzZWxlY3RlZFwiKS5kYXRhKFwiYmFzZWl0ZW1fcHJpbWFyeVwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChiYXNlaXRlbV9rZXkgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIGJhc2VpdGVtX3Byb3BzID0gYmFzZWl0ZW10eXBlc1tiYXNlaXRlbV9rZXldO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtX3Byb3BzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJjb3VsZCBub3QgZmluZFwiLCBiYXNlaXRlbV9rZXkpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBiYXNlaXRlbSA9IG5ldyBJdGVtKGJhc2VpdGVtX3Byb3BzKTtcclxuICAgICAgICAgICAgdmFyICRpbHZsID0gJChcIiN1c2VkX2Jhc2VpdGVtIGlucHV0Lmlsdmw6bm90KC50ZW1wbGF0ZSlcIik7XHJcbiAgICAgICAgICAgIGlmICgkaWx2bC5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIGJhc2VpdGVtLml0ZW1fbGV2ZWwgPSArJGlsdmwudmFsKCk7XHJcbiAgICAgICAgICAgIH0gXHJcbiAgICAgICAgICAgIHJldHVybiBiYXNlaXRlbTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGRpc3BsYXkgaXRlbV9jbGFzc2VzXHJcbiAgICAgICAgJC5lYWNoKEl0ZW0uSVRFTUNMQVNTRVMsIGZ1bmN0aW9uIChpZGVudCwgaXRlbV9jbGFzcykge1xyXG4gICAgICAgICAgICB2YXIgJG9wdGlvbiA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwiI2l0ZW1fY2xhc3NlcyBvcHRpb25cIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkb3B0aW9uLmFkZENsYXNzKGlkZW50KTtcclxuICAgICAgICAgICAgJG9wdGlvbi50ZXh0KGlkZW50KTtcclxuICAgICAgICAgICAgJG9wdGlvbi5kYXRhKFwiaWRlbnRcIiwgaWRlbnQpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJG9wdGlvbi5hcHBlbmRUbyhcIiNpdGVtX2NsYXNzZXNcIik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gY2hhbmdlIGl0ZW1fY2xhc3MgaGFuZGxlXHJcbiAgICAgICAgJChcIiNpdGVtX2NsYXNzZXNcIikub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgJHNlbGVjdGVkID0gJChcIm9wdGlvbjpzZWxlY3RlZFwiLCB0aGlzKTtcclxuICAgICAgICAgICAgdmFyIHN1Yl90YWcgPSAkKFwiI2l0ZW1fY2xhc3Nfc3ViX3RhZ1wiKS52YWwoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHNlbGVjdGVkIEl0ZW1DbGFzc1xyXG4gICAgICAgICAgICB2YXIgaXRlbV9jbGFzcyA9IEl0ZW0uSVRFTUNMQVNTRVNbJHNlbGVjdGVkLmRhdGEoXCJpZGVudFwiKV07XHJcbiAgICAgICAgICAgIGlmIChpdGVtX2NsYXNzID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIGJhc2VpdGVtcyB0aGF0IGhhdmUgdGhpcyBJdGVtQ2xhc3NcclxuICAgICAgICAgICAgLy8gbmVlZHMgbWFwIGluc3RlYWQgb2YgZ3JlcCBiZWNhdXNlIHRhYmxlIHN0cnVjdHVyZSBwcmltYXJ5ID0+IHRhYmxlIGNvbHNcclxuICAgICAgICAgICAgdmFyIGJhc2VpdGVtcyA9ICQubWFwKGJhc2VpdGVtdHlwZXMsIGZ1bmN0aW9uIChiYXNlaXRlbXR5cGUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChpdGVtX2NsYXNzLlBSSU1BUlkgPT09ICtiYXNlaXRlbXR5cGUuSXRlbUNsYXNzIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAmJiAoIXN1Yl90YWcgfHwgYmFzZWl0ZW10eXBlLlRhZ3NLZXlzLnNwbGl0KFwiLFwiKS5pbmRleE9mKHN1Yl90YWcpICE9PSAtMSkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYmFzZWl0ZW10eXBlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZW1wdHkgYmFzZWl0ZW1zXHJcbiAgICAgICAgICAgICQoXCIjYmFzZWl0ZW1zIG9wdGlvbjpub3QoLnRlbXBsYXRlKVwiKS5yZW1vdmUoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGRpc3BsYXkgYmFzZWl0ZW1zXHJcbiAgICAgICAgICAgICQuZWFjaChiYXNlaXRlbXMsIGZ1bmN0aW9uIChfLCBiYXNlaXRlbV9wcm9wcykge1xyXG4gICAgICAgICAgICAgICAgdmFyICRvcHRpb24gPSBjcmVhdGVfZnJvbV90ZW1wbGF0ZShcIiNiYXNlaXRlbXMgb3B0aW9uXCIpO1xyXG4gICAgICAgICAgICAgICAgJG9wdGlvbi50ZXh0KGJhc2VpdGVtX3Byb3BzLk5hbWUpO1xyXG4gICAgICAgICAgICAgICAgJG9wdGlvbi5hdHRyKFwiZGF0YS1iYXNlaXRlbV9wcmltYXJ5XCIsIGJhc2VpdGVtX3Byb3BzLnByaW1hcnkpO1xyXG4gICAgICAgICAgICAgICAgJG9wdGlvbi5hdHRyKFwiZGF0YS1uYW1lXCIsIGJhc2VpdGVtX3Byb3BzLk5hbWUpO1xyXG4gICAgICAgICAgICAgICAgJG9wdGlvbi5hcHBlbmRUbyhcIiNiYXNlaXRlbXNcIik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gc2VsZWN0IGZpcnN0IGJhc2VpdGVtXHJcbiAgICAgICAgICAgICQoXCIjYmFzZWl0ZW1zIG9wdGlvbjpub3QoLnRlbXBsYXRlKTpmaXJzdFwiKS5wcm9wKFwic2VsZWN0ZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBhbmQgdHJpZ2dlciBvbmNoYW5nZVxyXG4gICAgICAgICAgICAkKFwiI2Jhc2VpdGVtc1wiKS50cmlnZ2VyKFwiY2hhbmdlXCIpO1xyXG4gICAgICAgIH0pOyBcclxuICAgICAgICBcclxuICAgICAgICAvLyBjaGFuZ2UgYmFzZWl0ZW0gaGFuZGxlXHJcbiAgICAgICAgJChcIiNiYXNlaXRlbXNcIikub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAvLyBwZXJzaXN0ZW5jZVxyXG4gICAgICAgICAgICBiYXNlaXRlbSA9IGdldF9zZWxlY3RlZF9iYXNlaXRlbSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gdXBkYXRlIGd1aVxyXG4gICAgICAgICAgICBkaXNwbGF5X2Jhc2VpdGVtKGJhc2VpdGVtLCBcIiN1c2VkX2Jhc2VpdGVtXCIpO1xyXG4gICAgICAgICAgICBkaXNwbGF5X2F2YWlsYWJsZV9tb2RzKG1vZF9nZW5lcmF0b3IsIGJhc2VpdGVtKTsgIFxyXG4gICAgICAgICAgICBkaXNwbGF5X21vZF9nZW5fYXBwbGljYWJpbGl0eShiYXNlaXRlbSwgbW9kcyk7XHJcbiAgICAgICAgfSk7IFxyXG4gICAgICAgIFxyXG4gICAgICAgIHZhciBoYXNoYmFuZyA9IG5ldyBIYXNoYmFuZygpO1xyXG4gICAgICAgIHZhciBoYXNoYmFuZ19jaGFuZ2UgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciBuZXh0X2ZpbGU7XHJcbiAgICAgICAgICAgIHZhciBtYXBwaW5ncyA9IHtcclxuICAgICAgICAgICAgICAgIHJpbmdzOiAnUklORycsXHJcbiAgICAgICAgICAgICAgICBhbXVsZXRzOiAnQU1VTEVUJyxcclxuICAgICAgICAgICAgICAgIGJlbHRzOiAnQkVMVCcsXHJcbiAgICAgICAgICAgICAgICBqZXdlbHM6ICdKRVdFTCcsXHJcbiAgICAgICAgICAgICAgICBjbGF3czogJ0NMQVcnLFxyXG4gICAgICAgICAgICAgICAgZGFnZ2VyczogJ0RBR0dFUicsXHJcbiAgICAgICAgICAgICAgICBib3dzOiAnQk9XJyxcclxuICAgICAgICAgICAgICAgIHF1aXZlcnM6ICdRVUlWRVInLFxyXG4gICAgICAgICAgICAgICAgc3RhdmVzOiAnU1RBRkYnLFxyXG4gICAgICAgICAgICAgICAgc2NlcHRyZXM6ICdTQ0VQVFJFJyxcclxuICAgICAgICAgICAgICAgIHdhbmRzOiAnV0FORCcsXHJcbiAgICAgICAgICAgICAgICAnMWhfYXhlcyc6ICdBWEVfMUgnLFxyXG4gICAgICAgICAgICAgICAgJzJoX2F4ZXMnOiAnQVhFXzJIJyxcclxuICAgICAgICAgICAgICAgICcxaF9tYWNlcyc6ICdNQUNFXzFIJyxcclxuICAgICAgICAgICAgICAgICcyaF9tYWNlcyc6ICdNQUNFXzJIJyxcclxuICAgICAgICAgICAgICAgICcxaF9zd29yZHMnOiAnU1dPUkRfMUgnLFxyXG4gICAgICAgICAgICAgICAgJzJoX3N3b3Jkcyc6ICdTV09SRF8ySCcsXHJcbiAgICAgICAgICAgICAgICAnbWFwcyc6ICdNQVAnLFxyXG4gICAgICAgICAgICAgICAgYXJtb3VyczogJ0FSTU9VUicsXHJcbiAgICAgICAgICAgICAgICBnbG92ZXM6ICdHTE9WRVMnLFxyXG4gICAgICAgICAgICAgICAgYm9vdHM6ICdCT09UUycsXHJcbiAgICAgICAgICAgICAgICBoZWxtZXRzOiAnSEVMTUVUJyxcclxuICAgICAgICAgICAgICAgIHNoaWVsZHM6ICdTSElFTEQnXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHZhciAkYmFzZWl0ZW07XHJcbiAgICAgICAgICAgIHZhciBzdWJfdGFnID0gJyc7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBpdGVtY2xhc3NcclxuICAgICAgICAgICAgbmV4dF9maWxlID0gdGhpcy5nZXRQYXRoKCkubmV4dEZpbGUoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChtYXBwaW5nc1tuZXh0X2ZpbGVdKSB7XHJcbiAgICAgICAgICAgICAgICAkKCcjaXRlbV9jbGFzc2VzIC5pdGVtX2NsYXNzLicgKyBtYXBwaW5nc1tuZXh0X2ZpbGVdKS5wcm9wKFwic2VsZWN0ZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAkKCcjaXRlbV9jbGFzc2VzIC5pdGVtX2NsYXNzLlJJTkcnKS5wcm9wKFwic2VsZWN0ZWRcIiwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChbXCJhcm1vdXJzXCIsIFwiYm9vdHNcIiwgXCJnbG92ZXNcIiwgXCJoZWxtZXRzXCIsIFwic2hpZWxkc1wiXS5pbmRleE9mKG5leHRfZmlsZSkgIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBzZXQgbGlua3MgdG8gaXRlbV9jbGFzc1xyXG4gICAgICAgICAgICAgICAgJChcIiN0YWdfc2VsZWN0b3JfcmVxIGFcIikuZWFjaChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyICR0aGlzID0gJCh0aGlzKTtcclxuICAgICAgICAgICAgICAgICAgICAkdGhpcy5hdHRyKFwiaHJlZlwiLCBcIiMhL1wiICsgbmV4dF9maWxlICsgXCIvXCIgKyAkdGhpcy5hdHRyKFwiZGF0YS1zdWJfdGFnXCIpKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAkKFwiI3RhZ19zZWxlY3Rvcl9yZXFcIikuc2hvdygpO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKG5leHRfZmlsZSA9PT0gJ21hcHMnKSB7XHJcbiAgICAgICAgICAgICAgICAkKFwiI3RhZ19zZWxlY3Rvcl9tYXBcIikuc2hvdygpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgJChcIi5zdWJfdGFnX3NlbGVjdG9yXCIpLmhpZGUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gc3ViIGdyb3VwIG9mIGl0ZW1jbGFzcz8gc3RyX2FybW91ciwgZGV4X2FybW91ciBldGNcclxuICAgICAgICAgICAgbmV4dF9maWxlID0gdGhpcy5nZXRQYXRoKCkubmV4dEZpbGUoKTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBuZXh0X2ZpbGUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBzZWxlY3QgKiBmcm9tIHRhZ3Mgd2hlcmUgSWQgPSBuZXh0X2ZpbGVcclxuICAgICAgICAgICAgICAgIHN1Yl90YWcgPSAkLm1hcCh0YWdzLCBmdW5jdGlvbiAodGFnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRhZy5JZCA9PT0gbmV4dF9maWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0YWc7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfSlbMF07XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIHN1Yl90YWcgZm91bmRcclxuICAgICAgICAgICAgICAgIGlmIChzdWJfdGFnICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBzdWJfdGFnID0gc3ViX3RhZy5wcmltYXJ5O1xyXG4gICAgICAgICAgICAgICAgICAgICQoXCIuc3ViX3RhZ19zZWxlY3RvclwiKS5oaWRlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gbmV4dCBkaXJlY3RvcnlcclxuICAgICAgICAgICAgICAgICAgICBuZXh0X2ZpbGUgPSB0aGlzLmdldFBhdGgoKS5uZXh0RmlsZSgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICQoXCIjaXRlbV9jbGFzc19zdWJfdGFnXCIpLnZhbChzdWJfdGFnKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIG5vIHRyaWdnZXIgaXRlbWNsYXNzIGNoYW5nZVxyXG4gICAgICAgICAgICAkKCcjaXRlbV9jbGFzc2VzJykudHJpZ2dlcihcImNoYW5nZVwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGJhc2VpdGVtXHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgbmV4dF9maWxlID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgJGJhc2VpdGVtID0gJChcIiNiYXNlaXRlbXMgb3B0aW9uOm5vdCgudGVtcGxhdGUpW2RhdGEtbmFtZT0nXCIgKyBuZXh0X2ZpbGUucmVwbGFjZSgvXy8sIFwiIFwiKSArIFwiJ11cIik7XHJcbiAgICAgICAgICAgICAgICBpZiAoJGJhc2VpdGVtLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICRiYXNlaXRlbS5wcm9wKFwic2VsZWN0ZWRcIiwgdHJ1ZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIG5leHRfZmlsZSA9IHRoaXMuZ2V0UGF0aCgpLm5leHRGaWxlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIFRPRE8gY2F0Y2ggbm90IGZvdW5kXHJcbiAgICAgICAgICAgIC8vIEhhc2hiYW5nIGJhc2ljIGd1aSBuYXZpZ2F0aW9uXHJcbiAgICAgICAgICAgIGlmIChuZXh0X2ZpbGUgPT09ICd3aXRoUmVjaXBlJykge1xyXG4gICAgICAgICAgICAgICAgbmV4dF9maWxlID0gdGhpcy5nZXRQYXRoKCkubmV4dEZpbGUoKTtcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAobmV4dF9maWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbm9fYXR0YWNrX21vZHMnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdub19jYXN0ZXJfbW9kcyc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ25vX2F0dGFja19vcl9jYXN0ZXJfbW9kcyc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ2xsZF9tb2RzJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IE5vdEZvdW5kRXhjZXB0aW9uKCdyZWNpcGUgYCcgKyBuZXh0X2ZpbGUgKyAnYCBub3QgZm91bmQnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gVE9ETyBkb2VzbnQgd29ya1xyXG4gICAgICAgIGhhc2hiYW5nLm9uQ2hhbmdlKGhhc2hiYW5nX2NoYW5nZSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaGFzaGJhbmcud2l0aFdpbmRvdyh3aW5kb3cpO1xyXG4gICAgICAgIGhhc2hiYW5nX2NoYW5nZS5hcHBseShoYXNoYmFuZyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgJCh3aW5kb3cpLm9uKFwiaGFzaGNoYW5nZVwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGhhc2hiYW5nLndpdGhXaW5kb3cod2luZG93KTtcclxuICAgICAgICAgICAgaGFzaGJhbmdfY2hhbmdlLmFwcGx5KGhhc2hiYW5nKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gY2hhbmdlIG1vZGdlbiBoYW5kbGVcclxuICAgICAgICAkKFwiaW5wdXQuTW9kR2VuZXJhdG9yOnJhZGlvXCIpLm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgLy8gcGVyc2lzdGVuY2VcclxuICAgICAgICAgICAgbW9kX2dlbmVyYXRvciA9IGdldF9zZWxlY3RlZF9tb2RfZ2VuZXJhdG9yKCk7XHJcblxyXG4gICAgICAgICAgICAvLyB1cGRhdGUgZ3VpXHJcbiAgICAgICAgICAgIGRpc3BsYXlfYXZhaWxhYmxlX21vZHMobW9kX2dlbmVyYXRvciwgYmFzZWl0ZW0pO1xyXG4gICAgICAgICAgICAkKFwiI3VzZV9tb2RfZ2VuIC5uYW1lXCIpLnRleHQobW9kX2dlbmVyYXRvci5uYW1lKCkpO1xyXG4gICAgICAgICAgICAkKFwiI3VzZV9tb2RfZ2VuIC5jcmFmdGluZ2JlbmNob3B0aW9uXCIpLmVtcHR5KCk7XHJcbiAgICAgICAgICAgICQoXCIjdXNlX21vZF9nZW5cIikuYXR0cihcImRhdGEtYXBwbGljYWJsZVwiLCBcIlwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBjcmFmdGluZ2JlbmNob3B0aW9uc1xyXG4gICAgICAgICAgICB2YXIgJGNyYWZ0aW5nYmVuY2hvcHRpb25zID0gJChcIiNjcmFmdGluZ2JlbmNob3B0aW9uc1wiKTtcclxuICAgICAgICAgICAgJChcIi5jcmFmdGluZ2JlbmNob3B0aW9uOm5vdCgudGVtcGxhdGUpXCIsICRjcmFmdGluZ2JlbmNob3B0aW9ucykucmVtb3ZlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAobW9kX2dlbmVyYXRvciBpbnN0YW5jZW9mIE1hc3RlcmJlbmNoKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBkaXNwbGF5IG9wdGlvbnNcclxuICAgICAgICAgICAgICAgICQuZWFjaChtb2RfZ2VuZXJhdG9yLmNyYWZ0aW5nYmVuY2hvcHRpb25zLCBmdW5jdGlvbiAoaSwgY3JhZnRpbmdiZW5jaG9wdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIE1vZCBhdGxlYXN0IGRpc3BsYXllZCBzbyB3ZSBhbHNvIGRpc3BsYXkgdGhlIG9wdGlvblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICgkKFwiI1wiICsgTW9kLmRvbUlkKGNyYWZ0aW5nYmVuY2hvcHRpb24uTW9kc0tleSkpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgJG9wdGlvbiA9IGNyZWF0ZV9mcm9tX3RlbXBsYXRlKFwiLmNyYWZ0aW5nYmVuY2hvcHRpb25cIiwgJGNyYWZ0aW5nYmVuY2hvcHRpb25zKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICRvcHRpb24udmFsKGkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAkb3B0aW9uLnRleHQoY3JhZnRpbmdiZW5jaG9wdGlvbi5OYW1lKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICRjcmFmdGluZ2JlbmNob3B0aW9ucy5hcHBlbmQoJG9wdGlvbik7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIGRpc3BsYXkgbm8gb3B0aW9ucyBoaW50XHJcbiAgICAgICAgICAgICAgICAkKFwiI25vX2NyYWZ0aW5nYmVuY2hvcHRpb25zXCIpLnRvZ2dsZSgkKFwiLmNyYWZ0aW5nYmVuY2hvcHRpb246bm90KC50ZW1wbGF0ZSlcIikubGVuZ3RoID09PSAwKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gc2VsZWN0IGxhc3Qgb3B0aW9uIGJlY2F1c2Ugb3RoZXJ3aXNlIGEgcmVjZW50bHkgaGlkZGVuXHJcbiAgICAgICAgICAgICAgICAvLyAjbm9fY3JhZnRpbmdiZW5jaG9wdGlvbnMgd2lsbCBzdGlsbCBiZSBzZWxlY3RlZCBpbiBjaHJvbWVcclxuICAgICAgICAgICAgICAgIC8vIGFsc28gc2VsZWN0aW5nIGZpcnN0IHZpc2libGUgeWllbGRzIHRvIHdlaXJkIGludGVyYWN0aW9uc1xyXG4gICAgICAgICAgICAgICAgLy8gd2l0aCBoaWRkZW4gb3B0aW9ucyBcclxuICAgICAgICAgICAgICAgICQoXCJvcHRpb246bGFzdFwiLCAkY3JhZnRpbmdiZW5jaG9wdGlvbnMpLnByb3AoXCJzZWxlY3RlZFwiLCB0cnVlKTtcclxuICAgICAgICAgICAgICAgICRjcmFmdGluZ2JlbmNob3B0aW9ucy50cmlnZ2VyKFwiY2hhbmdlXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkKFwiaW5wdXQ6cmFkaW8uTW9kR2VuZXJhdG9yXCIpLnBhcmVudHMoXCIuYXBwbGljYWJsZVwiKS5yZW1vdmVDbGFzcyhcInNlbGVjdGVkXCIpO1xyXG4gICAgICAgICAgICAvLyBhZGQgc2VsZWN0ZWQgY2xhc3MgdG8gLmFwcGxpY2FibGUgY29udGFpbmVyXHJcbiAgICAgICAgICAgICQoXCJpbnB1dDpyYWRpbzpjaGVja2VkLk1vZEdlbmVyYXRvclwiKS5wYXJlbnRzKFwiLmFwcGxpY2FibGVcIikuYWRkQ2xhc3MoXCJzZWxlY3RlZFwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gY2hhbmdlZCBjcmFmdGluZ2JlbmNob3B0aW9uIGhhbmRsZVxyXG4gICAgICAgICQoXCIjY3JhZnRpbmdiZW5jaG9wdGlvbnNcIikub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKFwiI3VzZV9tb2RfZ2VuIC5jcmFmdGluZ2JlbmNob3B0aW9uXCIpLnRleHQoJChcIm9wdGlvbjpzZWxlY3RlZFwiLCB0aGlzKS50ZXh0KCkpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIG1vZCBnZW4gaGFuZGxlXHJcbiAgICAgICAgJChcIiN1c2VfbW9kX2dlblwiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIGFyZ3M7XHJcbiAgICAgICAgICAgIHZhciAkdGhpcyA9ICQodGhpcyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhtb2RfZ2VuZXJhdG9yLCBcIkBcIiwgYmFzZWl0ZW0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCEobW9kX2dlbmVyYXRvciBpbnN0YW5jZW9mIE1vZEdlbmVyYXRvcikpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwibW9kX2dlbmVyYXRvciBuZWVkcyB0byBiZSBvZiB0eXBlIE1vZEdlbmVyYXRvclwiKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCEoYmFzZWl0ZW0gaW5zdGFuY2VvZiBJdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJiYXNlaXRlbSBuZWVkcyB0byBiZSBvZiB0eXBlIEl0ZW1cIik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGJ1aWxkIGFwcGx5VG8gYXJnc1xyXG4gICAgICAgICAgICBhcmdzID0gW2Jhc2VpdGVtXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHdlIG5lZWQgdGhlIHNlbGVjdGVkIGNyYWZ0aW5nYmVuY2hvcHRpb25cclxuICAgICAgICAgICAgaWYgKG1vZF9nZW5lcmF0b3IgaW5zdGFuY2VvZiBNYXN0ZXJiZW5jaCkge1xyXG4gICAgICAgICAgICAgICAgYXJncy5wdXNoKCskKFwiI2NyYWZ0aW5nYmVuY2hvcHRpb25zIG9wdGlvbjpzZWxlY3RlZFwiKS52YWwoKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGFwcGx5XHJcbiAgICAgICAgICAgIGlmIChtb2RfZ2VuZXJhdG9yLmFwcGx5VG8uYXBwbHkobW9kX2dlbmVyYXRvciwgYXJncykpIHtcclxuICAgICAgICAgICAgICAgIC8vIGRpc3BsYXlcclxuICAgICAgICAgICAgICAgIGRpc3BsYXlfYmFzZWl0ZW0oYmFzZWl0ZW0sIFwiI3VzZWRfYmFzZWl0ZW1cIik7XHJcbiAgICAgICAgICAgICAgICBkaXNwbGF5X2F2YWlsYWJsZV9tb2RzKG1vZF9nZW5lcmF0b3IsIGJhc2VpdGVtKTtcclxuICAgICAgICAgICAgICAgIGRpc3BsYXlfbW9kX2dlbl9hcHBsaWNhYmlsaXR5KGJhc2VpdGVtLCBtb2RzKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJHRoaXMuYXR0cihcImRhdGEtYXBwbGljYWJsZVwiLCB0cnVlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIGZsYXNoIGVycm9yXHJcbiAgICAgICAgICAgICAgICAkdGhpcy5hdHRyKFwiZGF0YS1hcHBsaWNhYmxlXCIsIGZhbHNlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZGlzcGxheSBtb2QgZ3JvdXBcclxuICAgICAgICAkKFwiI2F2YWlsYWJsZV9tb2RzIHRib2R5LmNvcnJlY3RfZ3JvdXBcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQodGhpcykudG9nZ2xlQ2xhc3MoXCJjbGlja2VkXCIpLm5leHQoKS50b2dnbGUoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBkaXNwbGF5IGltcGxjaXRzXHJcbiAgICAgICAgJChcIiNpbXBsaWNpdHMtY2FwdGlvblwiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJCh0aGlzKS50b2dnbGVDbGFzcyhcImNsaWNrZWRcIikucGFyZW50cyhcInRhYmxlXCIpLmNoaWxkcmVuKFwidGJvZHlcIikudG9nZ2xlKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8galF1ZXJ5IFRhYmxlc29ydGVyIGNvbmZpZ1xyXG4gICAgICAgICQoXCIjcHJlZml4ZXMsICNzdWZmaXhlcywgI2ltcGxpY2l0c1wiKS50YWJsZXNvcnRlcih7XHJcbiAgICAgICAgICAgIGNzc0luZm9CbG9jayA6IFwidGFibGVzb3J0ZXItbm8tc29ydFwiXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gYWRkIG1vZFxyXG4gICAgICAgICQoXCIuYWRkX21vZFwiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgLy8gYXNzZXJ0IGJhc2VpdGVtIGluc3RhbmNlb2YgYmFzZWl0ZW1cclxuICAgICAgICAgICAgdmFyIHNlcmlhbGl6ZWQgPSAkKHRoaXMpLnBhcmVudHMoXCJ0clwiKS5kYXRhKFwibW9kXCIpO1xyXG4gICAgICAgICAgICB2YXIgbW9kID0gTW9kRmFjdG9yeS5kZXNlcmlhbGl6ZShzZXJpYWxpemVkKTtcclxuICAgICAgICAgICAgdmFyIGFkZGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAobW9kID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNvdWxkIG5vdCBkZXNlcmlhbGl6ZVwiLCBzZXJpYWxpemVkKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhiYXNlaXRlbSwgXCIrXCIsIG1vZCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBhZGRlZCA9IGJhc2VpdGVtLmFkZE1vZChtb2QpO1xyXG4gICAgICAgICAgICAvLyB0cnkgYXQgbGVhc3Qgb25lIHRpbWUgdG8gbWFrZSBtb3JlIHJvb20gZm9yIG1vZHNcclxuICAgICAgICAgICAgaWYgKCFhZGRlZCAmJiBiYXNlaXRlbS51cGdyYWRlUmFyaXR5KCkpIHtcclxuICAgICAgICAgICAgICAgIGFkZGVkID0gYmFzZWl0ZW0uYWRkTW9kKG1vZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChhZGRlZCkge1xyXG4gICAgICAgICAgICAgICAgZGlzcGxheV9iYXNlaXRlbShiYXNlaXRlbSwgXCIjdXNlZF9iYXNlaXRlbVwiKTtcclxuICAgICAgICAgICAgICAgIGRpc3BsYXlfYXZhaWxhYmxlX21vZHMobW9kX2dlbmVyYXRvciwgYmFzZWl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgZGlzcGxheV9tb2RfZ2VuX2FwcGxpY2FiaWxpdHkoYmFzZWl0ZW0sIG1vZHMpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gVE9ETyBmbGFzaCBlcnJvclxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gcmVtb3ZlIG1vZFxyXG4gICAgICAgICQoXCIucmVtb3ZlX21vZFwiKS5vbihcImNsaWNrXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyICRtb2QgPSAkKHRoaXMpLnBhcmVudHMoXCIubW9kXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmVtb3ZlTW9kKGJhc2VpdGVtLmdldE1vZCgkbW9kLmRhdGEoXCJwcmltYXJ5XCIpKSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBkaXNwbGF5X2Jhc2VpdGVtKGJhc2VpdGVtLCBcIiN1c2VkX2Jhc2VpdGVtXCIpO1xyXG4gICAgICAgICAgICBkaXNwbGF5X2F2YWlsYWJsZV9tb2RzKG1vZF9nZW5lcmF0b3IsIGJhc2VpdGVtKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBpbHZsIGhhbmRsZVxyXG4gICAgICAgICQoXCJpbnB1dC5pbHZsXCIpLm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgYmFzZWl0ZW0uaXRlbV9sZXZlbCA9ICskKHRoaXMpLnZhbCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZGlzcGxheV9hdmFpbGFibGVfbW9kcyhtb2RfZ2VuZXJhdG9yLCBiYXNlaXRlbSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gcmFyaXR5IGhhbmRsZVxyXG4gICAgICAgICQoXCIjaXRlbV9yYXJpdGllc1wiKS5vbihcImNoYW5nZVwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZWyQoXCJvcHRpb246c2VsZWN0ZWRcIiwgdGhpcykudmFsKCldO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgZGlzcGxheV9iYXNlaXRlbShiYXNlaXRlbSwgXCIjdXNlZF9iYXNlaXRlbVwiKTtcclxuICAgICAgICAgICAgZGlzcGxheV9hdmFpbGFibGVfbW9kcyhtb2RfZ2VuZXJhdG9yLCBiYXNlaXRlbSk7XHJcbiAgICAgICAgICAgIGRpc3BsYXlfbW9kX2dlbl9hcHBsaWNhYmlsaXR5KGJhc2VpdGVtLCBtb2RzKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBleHBhbmQgbW9kIGdyb3Vwc1xyXG4gICAgICAgICQoXCIjZXhwYW5kX21vZHNcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiZXhwYW5kXCIpO1xyXG4gICAgICAgICAgICAkKFwidGFibGUubW9kc1wiKS5hZGRDbGFzcyhcImV4cGFuZGVkXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJChcInRib2R5Lm1vZHM6bm90KC50ZW1wbGF0ZSlcIikuc2hvdygpO1xyXG4gICAgICAgICAgICAkKFwidGJvZHkuY29ycmVjdF9ncm91cDpub3QoLnRlbXBsYXRlKVwiKS5oaWRlKCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vIGNvbGxhcHNlIG1vZCBncm91cHMgPSBpbnZlcnQgI2V4cGFuZF9tb2RzXHJcbiAgICAgICAgJChcIiNjb2xsYXBzZV9tb2RzXCIpLm9uKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAkKFwidGFibGUubW9kc1wiKS5yZW1vdmVDbGFzcyhcImV4cGFuZGVkXCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgJChcInRib2R5Lm1vZHM6bm90KC50ZW1wbGF0ZSlcIikuaGlkZSgpO1xyXG4gICAgICAgICAgICAkKFwidGJvZHkuY29ycmVjdF9ncm91cDpub3QoLnRlbXBsYXRlKVwiKS5zaG93KCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gZGlzcGxheSBzdGF0cyB3aXRoIG1vZHMgaW4gaXRlbWJveCBoYW5kbGVcclxuICAgICAgICAkKFwiI2l0ZW1ib3hfc3RhdHNfd2l0aF9tb2RzXCIpLm9uKFwiY2hhbmdlXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgJChcIi5pdGVtYm94IC5tb2RzIC5tb2QgPiAqOm5vdCguc3RhdHMpXCIpLnRvZ2dsZSgkKHRoaXMpLnByb3AoXCJjaGVja2VkXCIpKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBkaXNwbGF5IGdyb3VwIG9mIE1vZEdlbmVyYXRvcnMgaGFuZGxlXHJcbiAgICAgICAgJChcIiNzaG93X2N1cnJlbmNpZXNcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQoXCIjTW9kR2VuZXJhdG9yIGZpZWxkc2V0LmN1cnJlbmNpZXNcIikudG9nZ2xlKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgJChcIiNzaG93X21hc3RlcmJlbmNoZXNcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQoXCIjTW9kR2VuZXJhdG9yIGZpZWxkc2V0Lm1hc3RlcmJlbmNoZXNcIikudG9nZ2xlKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gaGlkZSBncm91cCBvZiBNb2RHZW5lcmF0b3JzIGhhbmRsZVxyXG4gICAgICAgICQoXCIjTW9kR2VuZXJhdG9yIGZpZWxkc2V0IGEuY2xvc2VfZmllbGRzZXRcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICQodGhpcykucGFyZW50cyhcImZpZWxkc2V0XCIpLmhpZGUoKTsgXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaXRlbV9maXhlZF90b3AgPSAkKFwiI0l0ZW1cIikub2Zmc2V0KCkudG9wO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vICNJdGVtIGZpeGVkXHJcbiAgICAgICAgJCh3aW5kb3cpLm9uKFwic2Nyb2xsXCIsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyICR3aW5kb3cgPSAkKHdpbmRvdyk7XHJcbiAgICAgICAgICAgIHZhciAkSXRlbSA9ICQoXCIjSXRlbVwiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBvZmZzZXQgPSAkd2luZG93LnNjcm9sbFRvcCgpIC0gaXRlbV9maXhlZF90b3A7XHJcbiAgICAgICAgICAgIGlmIChvZmZzZXQgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAkSXRlbS5jc3Moe3RvcDogb2Zmc2V0ICsgXCJweFwifSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyB0ZXN0IGRvbSBoYW5kbGVzXHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gYWxsIGFmZml4ZXMgc2VsZWN0ZWQgYnkgZGVmYXVsdFxyXG4gICAgICAgICQoXCJpbnB1dC5Nb2RHZW5lcmF0b3I6cmFkaW9cIikuZmlsdGVyKFwiOmZpcnN0XCIpLnByb3AoXCJjaGVja2VkXCIsIHRydWUpO1xyXG4gICAgICAgICQoXCJpbnB1dC5Nb2RHZW5lcmF0b3I6cmFkaW9cIikuZmlsdGVyKFwiOmNoZWNrZWRcIikudHJpZ2dlcihcImNoYW5nZVwiKTtcclxuXHJcbiAgICAgICAgLy8kKFwiI3ByZWZpeGVzIHRib2R5Om5vdCgudGVtcGxhdGUpIC5hZGRfbW9kOmZpcnN0XCIpLnRyaWdnZXIoXCJjbGlja1wiKTtcclxuICAgICAgICBcclxuICAgICAgICAkKFwiI3VzZV9tb2RfZ2VuXCIpLnRyaWdnZXIoXCJjbGlja1wiKTtcclxuICAgIH0pO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4vSW5oZXJpdGFuY2UnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBpbnRlcmZhY2UgQXBwbGljYWJsZVxyXG4gICAgICovXHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNldEFwcGxpY2FibGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZUNhY2hlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgQXBwbGljYWJsZS5tYXAgPSBmdW5jdGlvbiAobW9kX2NvbGxlY3Rpb24sIG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICByZXR1cm4gJC5tYXAobW9kX2NvbGxlY3Rpb24uc2xpY2UoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBpZiAoQXBwbGljYWJsZS5pbXBsZW1lbnRlZEJ5KG1vZCkpIHtcclxuICAgICAgICAgICAgICAgIG1vZC5hcHBsaWNhYmxlVG8obW9kX2NvbnRhaW5lcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIG1vZDtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEFwcGxpY2FibGUubW9kcyA9IGZ1bmN0aW9uIChtb2RfY29sbGVjdGlvbiwgbW9kX2NvbnRhaW5lciwgc3VjY2Vzcykge1xyXG4gICAgICAgIHJldHVybiAkLmdyZXAobW9kX2NvbGxlY3Rpb24uc2xpY2UoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQXBwbGljYWJsZS5pbXBsZW1lbnRlZEJ5KG1vZCkgJiYgbW9kLmFwcGxpY2FibGVUbyhtb2RfY29udGFpbmVyLCBzdWNjZXNzKTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIGludGVyZmFjZSBwYXR0ZXJuXHJcbiAgICBBcHBsaWNhYmxlLmltcGxlbWVudGVkQnkgPSBmdW5jdGlvbiAoY2xhenopIHtcclxuICAgICAgICByZXR1cm4gIGNsYXp6LmFwcGxpY2FibGVUbyAhPT0gX191bmRlZmluZWQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBBcHBsaWNhYmxlLlVOU0NBTk5FRCA9IDA7XHJcbiAgICBBcHBsaWNhYmxlLlNVQ0NFU1MgPSAxO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEFwcGxpY2FibGU7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgcmVxdWlyZSgnLi9jb25jZXJucy9BcnJheScpO1xyXG4gICAgXHJcbiAgICBpZiAod2luZG93LmpRdWVyeSA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwibmVlZCBqUXVlcnkgb2JqZWN0IHdpdGggd2luZG93IGNvbnRleHRcIik7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdmFyICQgPSB3aW5kb3cualF1ZXJ5O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIERhdGFEZXBlbmRlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIGNsYXNzIGZvciBsb2FkaW5nIGEganNvbiBkYXRhXHJcbiAgICAgKi9cclxuICAgIHZhciBEYXRhRGVwZW5kZW5jeSA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtTdHJpbmd9IHBhdGggcGF0aCB0byBqc29uIGRhdGFcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gbG9hZGluZ19pbmRpY2F0b3IganF1ZXJ5IHNlbGVjdG9yIGZvciBsb2FkaW5nIGluZGljYXRvciBjbGFzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtEYXRhRGVwZW5kZW5jeX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAocGF0aCwgbG9hZGluZ19pbmRpY2F0b3IpIHtcclxuICAgICAgICAgICAgdGhpcy5wYXRoID0gcGF0aDtcclxuICAgICAgICAgICAgdGhpcy5sb2FkaW5nX2luZGljYXRvciA9IGxvYWRpbmdfaW5kaWNhdG9yO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5zdGF0ZV9hdHRyID0gRGF0YURlcGVuZGVuY3kuU1RBVEVfQVRUUjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHJldHVybnMgJC5nZXRKU09OIFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGRvbmUgY2FsbGJhY2sgb24gJC5hamF4LmRvbmVcclxuICAgICAgICAgKiBAcmV0dXJucyB7JC5EZXJlZmVycmVkfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldEpTT046IGZ1bmN0aW9uIChkb25lKSB7XHJcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICAgICAgJCh0aGlzLmxvYWRpbmdfaW5kaWNhdG9yKS5hdHRyKHRoaXMuc3RhdGVfYXR0ciwgRGF0YURlcGVuZGVuY3kuU1RBVEUuTE9BRElORyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gJC5nZXRKU09OKHRoaXMucGF0aCwgZG9uZSlcclxuICAgICAgICAgICAgICAgIC5kb25lKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICAgICAkKHRoYXQubG9hZGluZ19pbmRpY2F0b3IpLmF0dHIodGhhdC5zdGF0ZV9hdHRyLCBEYXRhRGVwZW5kZW5jeS5TVEFURS5ET05FKTtcclxuICAgICAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICAgICAgICAuZmFpbChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgJCh0aGF0LmxvYWRpbmdfaW5kaWNhdG9yKS5hdHRyKHRoYXQuc3RhdGVfYXR0ciwgRGF0YURlcGVuZGVuY3kuU1RBVEUuRkFJTCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgRGF0YURlcGVuZGVuY3kuU1RBVEUgPSB7XHJcbiAgICAgICAgTE9BRElORzogMSxcclxuICAgICAgICBET05FOiAyLFxyXG4gICAgICAgIEZBSUw6IDNcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogZGVmYXVsdCBsb2FkaW5nIHN0YXRlIGF0dHJcclxuICAgICAqL1xyXG4gICAgRGF0YURlcGVuZGVuY3kuU1RBVEVfQVRUUiA9IFwiZGF0YS1sb2FkaW5nLXN0YXRlXCI7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gRGF0YURlcGVuZGVuY3k7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi4vSW5oZXJpdGFuY2UnKTtcclxuICAgIFxyXG4gICAgdmFyIE5vdEZvdW5kRXhjZXB0aW9uID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAobXNnKSB7XHJcbiAgICAgICAgICAgIHRoaXMubWVzc2FnZSAgPSBtc2c7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTm90Rm91bmRFeGNlcHRpb247XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgcmVxdWlyZSgnLi9jb25jZXJucy9BcnJheScpO1xyXG4gICAgXHJcbiAgICBpZiAoJCA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICB2YXIgJCA9IHJlcXVpcmUoJy4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogdGFibGUgcm93IGZyb20gY29udGVudC5nZ3BrXHJcbiAgICAgKi9cclxuICAgIHZhciBHZ3BrRW50cnkgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChwcm9wcykge1xyXG4gICAgICAgICAgICB0aGlzLnByb3BzID0gcHJvcHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBjb21tYSBzZXBhcmF0ZWQgdmFsdWVzIGFyZSBhcnJheXNcclxuICAgICAgICAgKiBhbHJlYWR5IGludCBjYXN0IGlmIHBvc3NpYmxlXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGtleVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICB2YWx1ZUFzQXJyYXk6IGZ1bmN0aW9uIChrZXkpIHtcclxuICAgICAgICAgICAgLy8gZmlsdGVyKGVtcHR5KSArIG1hcChwYXJzZUludClcclxuICAgICAgICAgICAgcmV0dXJuICQubWFwKHRoaXMuZ2V0UHJvcChrZXkpLnNwbGl0KFwiLFwiKSwgZnVuY3Rpb24gKG4pIHtcclxuICAgICAgICAgICAgICAgIGlmIChuID09PSBudWxsIHx8IG4gPT09ICcnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChpc05hTigrbikpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiArbjtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRQcm9wOiBmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnByb3BzW2tleV0gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImtleSBgXCIgKyBrZXkgKyBcImAgZG9lc250IGV4aXN0XCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnByb3BzW2tleV07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzZXRQcm9wOiBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5wcm9wc1trZXldICE9PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcm9wc1trZXldID0gdmFsdWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBHZ3BrRW50cnk7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgdmFyIFBhdGggPSByZXF1aXJlKCcuL1BhdGgnKTtcclxuICAgIFxyXG4gICAgdmFyIEhhc2hiYW5nID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAocHJlZml4KSB7XHJcbiAgICAgICAgICAgIHRoaXMucGFyYW1zID0ge307XHJcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IG5ldyBQYXRoKFwiXCIpO1xyXG4gICAgICAgICAgICB0aGlzLnByZWZpeCA9IHByZWZpeDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMub25fY2hhbmdlID0gbnVsbDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG9uQ2hhbmdlOiBmdW5jdGlvbiAoY2IpIHtcclxuICAgICAgICAgICAgdGhpcy5vbl9jaGFuZ2UgPSBjYjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRyaWdnZXJDaGFuZ2U6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzLm9uX2NoYW5nZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMub25fY2hhbmdlLmFwcGx5KHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5XHJcbiAgICAgICAgICogQHBhcmFtIHtNaXhlZH0gdmFsdWVcclxuICAgICAgICAgKiBAcmV0dXJucyB7SGFzaGJhbmd9IHRoaXMgdG8gY2hhaW5cclxuICAgICAgICAgKi9cclxuICAgICAgICBzZXRQYXJhbXM6IGZ1bmN0aW9uIChrZXksIHZhbHVlKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGFyYW1zW2tleV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGNoYWluYWJsZVxyXG4gICAgICAgICAgICByZXR1cm4gdGhpcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldFBhdGg6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucGF0aDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXHJcbiAgICAgICAgICogQHJldHVybnMge0hhc2hiYW5nfSB0aGlzIHRvIGNoYWluXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2V0UGF0aDogZnVuY3Rpb24gKHBhdGgpIHtcclxuICAgICAgICAgICAgdGhpcy5wYXRoID0gbmV3IFBhdGgocGF0aCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBjaGFpbmFibGVcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBnZW5lcmF0ZXMgdXJsIGZyb20gY2xhc3MgcHJvcGVydGllc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdXJsOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciB1cmwgPSBcIiNcIiArIHRoaXMucHJlZml4ICsgdGhpcy5wYXRoO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCEkLmlzRW1wdHlPYmplY3QodGhpcy5wYXJhbXMpKSB7XHJcbiAgICAgICAgICAgICAgICB1cmwgKz0gXCI/XCIgKyBIYXNoYmFuZy5xdWVyeV9zdHJpbmcodGhpcy5wYXJhbXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gdXJsO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcGFyc2U6IGZ1bmN0aW9uICh1cmwpIHtcclxuICAgICAgICAgICAgdGhpcy5pbml0KCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHVybCAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB2YXIgdXJsX21hdGNoID0gdXJsLm1hdGNoKC8hKFtcXHdcXC9dKykoXFw/LiopPy8pO1xyXG4gICAgICAgICAgICBpZiAodXJsX21hdGNoICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNldFBhdGgodXJsX21hdGNoWzFdKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0UGFyYW1zKHVybF9tYXRjaFsyXSk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRyaWdnZXJDaGFuZ2UoKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICB3aXRoV2luZG93OiBmdW5jdGlvbiAod2luZG93KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhcnNlKHdpbmRvdy5sb2NhdGlvbi5oYXNoLnNsaWNlKDEpKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgSGFzaGJhbmcuZnJvbVdpbmRvdyA9IGZ1bmN0aW9uICh3aW5kb3cpIHtcclxuICAgICAgICByZXR1cm4gbmV3IEhhc2hiYW5nKCkud2l0aFdpbmRvdyh3aW5kb3cpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgSGFzaGJhbmcucGFyc2UgPSBmdW5jdGlvbiAodXJsKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBIYXNoYmFuZy5wYXJzZSh1cmwpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgSGFzaGJhbmcucXVlcnlfc3RyaW5nID0gZnVuY3Rpb24gKHBhcmFtcykge1xyXG4gICAgICAgIHJldHVybiAkLm1hcChwYXJhbXMsIGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiBrZXkgKyBcIj1cIiArIHZhbHVlO1xyXG4gICAgICAgIH0pLmpvaW4oXCImXCIpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBIYXNoYmFuZztcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBTaW1wbGUgSmF2YVNjcmlwdCBJbmhlcml0YW5jZVxyXG4gKiBCeSBKb2huIFJlc2lnIGh0dHA6Ly9lam9obi5vcmcvXHJcbiAqIE1JVCBMaWNlbnNlZC5cclxuICovXHJcbi8vIEluc3BpcmVkIGJ5IGJhc2UyIGFuZCBQcm90b3R5cGVcclxuKGZ1bmN0aW9uKCl7XHJcbiAgdmFyIGluaXRpYWxpemluZyA9IGZhbHNlLCBmblRlc3QgPSAveHl6Ly50ZXN0KGZ1bmN0aW9uKCl7eHl6O30pID8gL1xcYl9zdXBlclxcYi8gOiAvLiovO1xyXG4gXHJcbiAgLy8gVGhlIGJhc2UgQ2xhc3MgaW1wbGVtZW50YXRpb24gKGRvZXMgbm90aGluZylcclxuICB2YXIgQ2xhc3MgPSBmdW5jdGlvbigpe307XHJcbiBcclxuICAvLyBDcmVhdGUgYSBuZXcgQ2xhc3MgdGhhdCBpbmhlcml0cyBmcm9tIHRoaXMgY2xhc3NcclxuICBDbGFzcy5leHRlbmQgPSBmdW5jdGlvbihwcm9wKSB7XHJcbiAgICB2YXIgX3N1cGVyID0gdGhpcy5wcm90b3R5cGU7XHJcbiAgIFxyXG4gICAgLy8gSW5zdGFudGlhdGUgYSBiYXNlIGNsYXNzIChidXQgb25seSBjcmVhdGUgdGhlIGluc3RhbmNlLFxyXG4gICAgLy8gZG9uJ3QgcnVuIHRoZSBpbml0IGNvbnN0cnVjdG9yKVxyXG4gICAgaW5pdGlhbGl6aW5nID0gdHJ1ZTtcclxuICAgIHZhciBwcm90b3R5cGUgPSBuZXcgdGhpcygpO1xyXG4gICAgaW5pdGlhbGl6aW5nID0gZmFsc2U7XHJcbiAgIFxyXG4gICAgLy8gQ29weSB0aGUgcHJvcGVydGllcyBvdmVyIG9udG8gdGhlIG5ldyBwcm90b3R5cGVcclxuICAgIGZvciAodmFyIG5hbWUgaW4gcHJvcCkge1xyXG4gICAgICAvLyBDaGVjayBpZiB3ZSdyZSBvdmVyd3JpdGluZyBhbiBleGlzdGluZyBmdW5jdGlvblxyXG4gICAgICBwcm90b3R5cGVbbmFtZV0gPSB0eXBlb2YgcHJvcFtuYW1lXSA9PSBcImZ1bmN0aW9uXCIgJiZcclxuICAgICAgICB0eXBlb2YgX3N1cGVyW25hbWVdID09IFwiZnVuY3Rpb25cIiAmJiBmblRlc3QudGVzdChwcm9wW25hbWVdKSA/XHJcbiAgICAgICAgKGZ1bmN0aW9uKG5hbWUsIGZuKXtcclxuICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgdmFyIHRtcCA9IHRoaXMuX3N1cGVyO1xyXG4gICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBBZGQgYSBuZXcgLl9zdXBlcigpIG1ldGhvZCB0aGF0IGlzIHRoZSBzYW1lIG1ldGhvZFxyXG4gICAgICAgICAgICAvLyBidXQgb24gdGhlIHN1cGVyLWNsYXNzXHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyID0gX3N1cGVyW25hbWVdO1xyXG4gICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBUaGUgbWV0aG9kIG9ubHkgbmVlZCB0byBiZSBib3VuZCB0ZW1wb3JhcmlseSwgc28gd2VcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIGl0IHdoZW4gd2UncmUgZG9uZSBleGVjdXRpbmdcclxuICAgICAgICAgICAgdmFyIHJldCA9IGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7ICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIgPSB0bXA7XHJcbiAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiByZXQ7XHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIH0pKG5hbWUsIHByb3BbbmFtZV0pIDpcclxuICAgICAgICBwcm9wW25hbWVdO1xyXG4gICAgfVxyXG4gICBcclxuICAgIC8vIFRoZSBkdW1teSBjbGFzcyBjb25zdHJ1Y3RvclxyXG4gICAgZnVuY3Rpb24gQ2xhc3MoKSB7XHJcbiAgICAgIC8vIEFsbCBjb25zdHJ1Y3Rpb24gaXMgYWN0dWFsbHkgZG9uZSBpbiB0aGUgaW5pdCBtZXRob2RcclxuICAgICAgaWYgKCAhaW5pdGlhbGl6aW5nICYmIHRoaXMuaW5pdCApXHJcbiAgICAgICAgdGhpcy5pbml0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9XHJcbiAgIFxyXG4gICAgLy8gUG9wdWxhdGUgb3VyIGNvbnN0cnVjdGVkIHByb3RvdHlwZSBvYmplY3RcclxuICAgIENsYXNzLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcclxuICAgXHJcbiAgICAvLyBFbmZvcmNlIHRoZSBjb25zdHJ1Y3RvciB0byBiZSB3aGF0IHdlIGV4cGVjdFxyXG4gICAgQ2xhc3MucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ2xhc3M7XHJcbiBcclxuICAgIC8vIEFuZCBtYWtlIHRoaXMgY2xhc3MgZXh0ZW5kYWJsZVxyXG4gICAgQ2xhc3MuZXh0ZW5kID0gYXJndW1lbnRzLmNhbGxlZTtcclxuICAgXHJcbiAgICByZXR1cm4gQ2xhc3M7XHJcbiAgfTtcclxuICBcclxuICBtb2R1bGUuZXhwb3J0cyA9IENsYXNzO1xyXG59KSgpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoXCIuL0luaGVyaXRhbmNlXCIpO1xyXG4gICAgXHJcbiAgICByZXF1aXJlKCcuL2NvbmNlcm5zL0FycmF5Jyk7XHJcbiAgICByZXF1aXJlKCcuL2NvbmNlcm5zL09iamVjdCcpO1xyXG4gICAgXHJcbiAgICBpZiAoJCA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICB2YXIgJCA9IHJlcXVpcmUoJy4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgTG9jYWxpemF0aW9uXHJcbiAgICAgKiBcclxuICAgICAqIGNsYXNzIGZvciBsb2NhbGl6aW5nIGEgZ3JvdXAgb2YgZW50aXRpZXNcclxuICAgICAqL1xyXG4gICAgdmFyIExvY2FsaXphdGlvbiA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtPYmplY3R9IGRhdGEgdGhlIGxvY2FsaXphdGlvbiBqc29uIGRhdGFcclxuICAgICAgICAgKiBAcmV0dXJucyB7TG9jYWxpemF0aW9ufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5XHJcbiAgICAgICAgICogQHBhcmFtIHsqfSAuLi5hcmdzIHBhcmFtcyBmb3IgTG9jYWxpemF0aW9uOjpsb29rdXBTdHJpbmdcclxuICAgICAgICAgKiBAcmV0dXJucyB7TG9jYWxpemF0aW9uOjpsb29rdXBTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdDogZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgICAgICB2YXIgcGFyYW1zID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcclxuICAgICAgICAgICAgcmV0dXJuIExvY2FsaXphdGlvbi5maWxsU3RyaW5nKHRoaXMubG9va3VwU3RyaW5nKGtleSwgcGFyYW1zKSwgcGFyYW1zKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGNoZWNrcyBhbGwgcG9zc2libGUgc3RyaW5ncyBmcm9tIGtleSBhZ2FpbnN0IHRoZSBwYXJhbXNcclxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5XHJcbiAgICAgICAgICogQHBhcmFtIHthcnJheX0gcGFyYW1zXHJcbiAgICAgICAgICogQHJldHVybnMge09iamVjdHxDbGFzc0BjYWxsO2V4dGVuZC5maWxsU3RyaW5nLnN0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBsb29rdXBTdHJpbmc6IGZ1bmN0aW9uIChrZXksIHBhcmFtcykge1xyXG4gICAgICAgICAgICB2YXIgdXNlZF9vcHRpb24gPSBudWxsO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMuZGF0YVtrZXldID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGV2ZXJ5IG9wdGlvblxyXG4gICAgICAgICAgICAkLmVhY2godGhpcy5kYXRhW2tleV0sIGZ1bmN0aW9uIChpLCBvcHRpb24pIHtcclxuICAgICAgICAgICAgICAgIGlmIChpc05hTigraSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBjb250aW51ZSBvbiBzdHJpbmcga2V5c1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICB2YXIgYW5kX2JpdCA9IDE7XHJcbiAgICAgICAgICAgICAgICAvLyBsb29wIHRocm91Z2ggZXZlcnkgYW5kIGNvbmRpdGlvblxyXG4gICAgICAgICAgICAgICAgJC5lYWNoKG9wdGlvbi5hbmQsIGZ1bmN0aW9uIChqLCByYW5nZV9zdHJpbmcpIHtcclxuICAgICAgICAgICAgICAgICAgICBhbmRfYml0ICY9ICtMb2NhbGl6YXRpb24uaW5SYW5nZShyYW5nZV9zdHJpbmcsIHBhcmFtc1tqXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFhbmRfYml0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChhbmRfYml0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdXNlZF9vcHRpb24gPSBvcHRpb247XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh1c2VkX29wdGlvbiA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhcIm5vIHZhbGlkIG1hdGNoIGZvclwiLCB0aGlzLmRhdGFba2V5XSwgXCJ3aXRoXCIsIHBhcmFtcyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAodXNlZF9vcHRpb24uaGFuZGxlcykge1xyXG4gICAgICAgICAgICAgICAgJC5lYWNoKHVzZWRfb3B0aW9uLmhhbmRsZXMsIGZ1bmN0aW9uIChpLCBoYW5kbGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBwYXJhbXNbaS0xXSA9ICQubWFwKHBhcmFtc1tpLTFdLCBMb2NhbGl6YXRpb24uaGFuZGxlc1toYW5kbGVdKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXVzZWRfb3B0aW9uLnRleHQpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKHRoaXMuZGF0YVtrZXldLCB1c2VkX29wdGlvbik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB1c2VkX29wdGlvbi50ZXh0O1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIHJlcGxhY2VzIHRoZSBwYXJhbXMgd2l0aGluIHRoZSBzdHJpbmcgd2l0aCB0aGUgZ2l2ZW4gcGFyYW1zXHJcbiAgICAgKiBcclxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdHJpbmdcclxuICAgICAqIEBwYXJhbSB7QXJyYXl9IHBhcmFtc1xyXG4gICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAqL1xyXG4gICAgTG9jYWxpemF0aW9uLmZpbGxTdHJpbmcgPSBmdW5jdGlvbiAoc3RyaW5nLCBwYXJhbXMpIHtcclxuICAgICAgICAkLmVhY2gocGFyYW1zLCBmdW5jdGlvbiAoaSwgcGFyYW0pIHtcclxuICAgICAgICAgICAgc3RyaW5nID0gc3RyaW5nLnJlcGxhY2UoXCJ7cGFyYW1fXCIgKyAoaSArIDEpICsgXCJ9XCIsIExvY2FsaXphdGlvbi5yYW5nZVN0cmluZyhwYXJhbSkpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBzdHJpbmc7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNoZWNrcyBpZiB2YWx1ZXMgYXJlIHdpdGhpbiBhIHJhbmdlX3N0cmluZyBmcm9tIHRoZSBwb2UgZGVzYyBmaWxlcyBcclxuICAgICAqIEBwYXJhbSB7dHlwZX0gcmFuZ2Vfc3RyaW5nXHJcbiAgICAgKiBAcGFyYW0ge3R5cGV9IHZhbHVlc1xyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgKi9cclxuICAgIExvY2FsaXphdGlvbi5pblJhbmdlID0gZnVuY3Rpb24gKHJhbmdlX3N0cmluZywgdmFsdWVzKSB7XHJcbiAgICAgICAgaWYgKHJhbmdlX3N0cmluZyA9PT0gX191bmRlZmluZWQgfHwgdmFsdWVzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZhciByYW5nZSA9IHJhbmdlX3N0cmluZy5zcGxpdChcInxcIik7XHJcbiAgICAgICAgdmFyIHZhbHVlID0gTWF0aC5tYXguYXBwbHkoTWF0aCwgdmFsdWVzKTtcclxuICAgICAgICAgICAgIFxyXG4gICAgICAgIGlmIChyYW5nZS5sZW5ndGggPT09IDEgJiYgKCtyYW5nZVswXSA9PT0gK3ZhbHVlIHx8IHJhbmdlWzBdID09PSAnIycpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAocmFuZ2VbMF0gPT09ICcjJykge1xyXG4gICAgICAgICAgICByYW5nZVswXSA9IE51bWJlci5ORUdBVElWRV9JTkZJTklUWTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHJhbmdlWzFdID09PSAnIycpIHtcclxuICAgICAgICAgICAgcmFuZ2VbMV0gPSBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICgrcmFuZ2VbMF0gPD0gK3ZhbHVlICYmICt2YWx1ZSA8PSArcmFuZ2VbMV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIExvY2FsaXphdGlvbi5yYW5nZVN0cmluZyA9IGZ1bmN0aW9uIChyYW5nZSkge1xyXG4gICAgICAgIGlmIChyYW5nZS5sZW5ndGggPCAyIHx8IHJhbmdlWzBdID09PSByYW5nZVsxXSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmFuZ2VbMF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBcIihcIiArIHJhbmdlLmpvaW4oXCIgdG8gXCIpICsgXCIpXCI7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGxhbWJkYXMgIGZvciBwYXJhbWV0ZXIgaGFuZGxlc1xyXG4gICAgICovXHJcbiAgICBMb2NhbGl6YXRpb24uaGFuZGxlcyA9IHtcclxuICAgICAgICBkZWNpc2Vjb25kc190b19zZWNvbmRzOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaSAqIDEwO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZGl2aWRlX2J5X29uZV9odW5kcmVkOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaSAvIDEwMDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHBlcl9taW51dGVfdG9fcGVyX3NlY29uZDogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGkgLyA2MDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1pbGxpc2Vjb25kc190b19zZWNvbmRzOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaSAvIDEwMDA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuZWdhdGU6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAtaTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGRpdmlkZV9ieV9vbmVfaHVuZHJlZF9hbmRfbmVnYXRlOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gLWkgLyAxMDA7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBvbGRfbGVlY2hfcGVyY2VudDogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGkgLyA1O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgb2xkX2xlZWNoX3Blcm15cmlhZDogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGkgLyA1MDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHBlcl9taW51dGVfdG9fcGVyX3NlY29uZF8wZHA6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUludChNYXRoLnJvdW5kKGkgLyA2MCwgMCksIDEwKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHBlcl9taW51dGVfdG9fcGVyX3NlY29uZF8yZHA6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUludChNYXRoLnJvdW5kKGkgLyA2MCwgMiksIDEwKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1pbGxpc2Vjb25kc190b19zZWNvbmRzXzBkcDogZnVuY3Rpb24gKGkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHBhcnNlSW50KE1hdGgucm91bmQoaSAvIDEwMDAsIDApLCAxMCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtaWxsaXNlY29uZHNfdG9fc2Vjb25kc18yZHA6IGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBwYXJzZUludChNYXRoLnJvdW5kKGkgLyAxMDAwLCAyKSwgMTApO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXVsdGlwbGljYXRpdmVfZGFtYWdlX21vZGlmaWVyOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1vZF92YWx1ZV90b19pdGVtX2NsYXNzOiBmdW5jdGlvbiAoaSkge1xyXG4gICAgICAgICAgICByZXR1cm4gaTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IExvY2FsaXphdGlvbjtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuL0luaGVyaXRhbmNlJyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgTWV0YWRhdGFcclxuICAgICAqIFxyXG4gICAgICogcmVwcmVzZW50YXRpb24gb2YgYSAub3QgZmlsZSBpbiBNRVRBREFUQSBcclxuICAgICAqL1xyXG4gICAgdmFyIE1ldGFEYXRhID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoY2xhenosIHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuY2xhenogPSBjbGF6ejtcclxuICAgICAgICAgICAgdGhpcy5wcm9wcyA9IHByb3BzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNBOiBmdW5jdGlvbiAoY2xhenopIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNsYXp6ID09PSB0aGlzLmNsYXp6IHx8IFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucHJvcHMuaW5oZXJpdGFuY2UuaW5kZXhPZihjbGF6eikgIT09IC0xO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdmFsdWVPZjogZnVuY3Rpb24gKGZhc2NhZGUsIGtleSwgZXhwZWN0KSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnByb3BzW2Zhc2NhZGVdICYmIHRoaXMucHJvcHNbZmFzY2FkZV1ba2V5XSkge1xyXG4gICAgICAgICAgICAgICAgc3dpdGNoIChleHBlY3QpIHtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIE1ldGFEYXRhLkVYUEVDVC5TVFJJTkc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnByb3BzW2Zhc2NhZGVdW2tleV1bMF07XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBNZXRhRGF0YS5FWFBFQ1QuTlVNQkVSOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gK3RoaXMucHJvcHNbZmFzY2FkZV1ba2V5XVswXTtcclxuICAgICAgICAgICAgICAgICAgICBjYXNlIE1ldGFEYXRhLkVYUEVDVC5BUlJBWTpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMucHJvcHNbZmFzY2FkZV1ba2V5XTtcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIklsbGVnYWxBcmd1bWVudCBmb3IgdmFsdWVPZihmYXNjYWRlLCBrZXksIGV4cGVjdClcIiwgZmFzY2FkZSwga2V5LCBleHBlY3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gX191bmRlZmluZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIE1ldGFEYXRhLmJ1aWxkID0gZnVuY3Rpb24gKGNsYXp6LCBtZXRhX2RhdGFzKSB7XHJcbiAgICAgICAgdmFyIG1ldGFfZGF0YSA9IG1ldGFfZGF0YXNbY2xhenpdO1xyXG4gICAgICAgIGlmIChtZXRhX2RhdGEgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gbmV3IE1ldGFEYXRhKGNsYXp6LCBtZXRhX2RhdGEpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgTWV0YURhdGEuRVhQRUNUID0ge1xyXG4gICAgICAgIE5VTUJFUjogMSxcclxuICAgICAgICBTVFJJTkc6IDIsXHJcbiAgICAgICAgQVJSQVk6IDNcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTWV0YURhdGE7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIE1vZENvbnRhaW5lciA9IHJlcXVpcmUoJy4vTW9kQ29udGFpbmVyJyk7XHJcbiAgICB2YXIgTWV0YURhdGEgPSByZXF1aXJlKCcuLi9NZXRhRGF0YScpO1xyXG4gICAgdmFyIE1vZCA9IHJlcXVpcmUoJy4uL21vZHMvTW9kJyk7XHJcbiAgICB2YXIgVmFsdWVSYW5nZSA9IHJlcXVpcmUoJy4uL1ZhbHVlUmFuZ2UnKTtcclxuICAgIHZhciBHZ3BrRW50cnkgPSByZXF1aXJlKCcuLi9HZ3BrRW50cnknKTtcclxuICAgIHZhciBJdGVtSW1wbGljaXRzID0gcmVxdWlyZSgnLi9JdGVtSW1wbGljaXRzJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZU1vZCA9IHJlcXVpcmUoJy4uL21vZHMvQXBwbGljYWJsZU1vZCcpO1xyXG4gICAgXHJcbiAgICBpZiAoJCA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogSXRlbSBDbGFzcyBleHRlbmRzIEBsaW5rIE1vZENvbnRhaW5lclxyXG4gICAgICogXHJcbiAgICAgKiByZXByZXNlbnRzIGFuIGluZ2FtZSBpdGVtIChib290cywgbWFwcywgcmluZ3MgZm9yIGV4YW1wbGUpXHJcbiAgICAgKiB0aGUgY2xhc3Mgb25seSByZXByZXNlbnRzIHRoZSBleHBsaWNpdHMgYW5kIGlzIGEgZmFzY2FkZSBmb3IgYW4gXHJcbiAgICAgKiBhZGRpdGlvbmFsIGltcGxpY2l0IGNvbnRhaW5lclxyXG4gICAgICovXHJcbiAgICB2YXIgSXRlbSA9IE1vZENvbnRhaW5lci5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wcyBmb3IgQGxpbmsgR2dwa0VudHJ5XHJcbiAgICAgICAgICogQHJldHVybnMge0l0ZW19XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICAgICAgaWYgKEl0ZW0ubWV0YV9kYXRhID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcInBscyBpbml0IG1ldGEgZGF0YVwiKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBleHBsaWNpdHNcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGRlZmF1bHRcclxuICAgICAgICAgICAgdGhpcy5yYXJpdHkgPSBJdGVtLlJBUklUWS5OT1JNQUw7XHJcbiAgICAgICAgICAgIHRoaXMuaXRlbV9sZXZlbCA9IEl0ZW0uTUFYX0lMVkw7XHJcbiAgICAgICAgICAgIHRoaXMucmFuZG9tX25hbWUgPSBcIlJhbmRvbSBOYW1lXCI7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBwYXJzZSBlbnRyeVxyXG4gICAgICAgICAgICB0aGlzLmVudHJ5ID0gbmV3IEdncGtFbnRyeShwcm9wcyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBnZXQgbWV0YSBkYXRhIGtleVxyXG4gICAgICAgICAgICAvLyBwYXRoLnNwbGl0KC9bXFxcXC9dLykucG9wKCkgOj0gYmFzZW5hbWUgXHJcbiAgICAgICAgICAgIHZhciBjbGF6eiA9IHRoaXMuZW50cnkuZ2V0UHJvcChcIkluaGVyaXRzRnJvbVwiKS5zcGxpdCgvW1xcXFwvXS8pLnBvcCgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gbWV0YSBkYXRhIGV4aXN0cz9cclxuICAgICAgICAgICAgdGhpcy5tZXRhX2RhdGEgPSBNZXRhRGF0YS5idWlsZChjbGF6eiwgSXRlbS5tZXRhX2RhdGEpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gaW1wbGljaXRzXHJcbiAgICAgICAgICAgIHRoaXMuaW1wbGljaXRzID0gbmV3IEl0ZW1JbXBsaWNpdHMoW10pO1xyXG4gICAgICAgICAgICAkLmVhY2godGhpcy5lbnRyeS52YWx1ZUFzQXJyYXkoXCJJbXBsaWNpdF9Nb2RzS2V5c1wiKSwgZnVuY3Rpb24gKF8sIG1vZF9rZXkpIHtcclxuICAgICAgICAgICAgICAgIGlmICghdGhhdC5pbXBsaWNpdHMuYWRkTW9kKG5ldyBBcHBsaWNhYmxlTW9kKE1vZC5tb2RzW21vZF9rZXldKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcImNvdWxkIG5vdCBhZGRcIiwgbW9kX2tleSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyBhIG1vZCBpZiB0aGVyZXMgcm9vbSBmb3IgaXRcclxuICAgICAgICAgKiBubyBzb3BoaXN0aWNhdGVkIGRvbWFpbiBjaGVjay4gb25seSBpZiBhZmZpeCB0eXBlIGlzIGZ1bGwgb3Igbm90XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQG92ZXJyaWRlXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2R9IG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIHN1Y2Nlc3NcclxuICAgICAgICAgKi9cclxuICAgICAgICBhZGRNb2Q6IGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgaWYgKCEobW9kIGluc3RhbmNlb2YgTW9kKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignbW9kIG11c3QgYmUgaW5zdGFuY2Ugb2YgYE1vZGAnKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKG1vZC5pc1ByZWZpeCgpICYmIHRoaXMuZ2V0UHJlZml4ZXMoKS5sZW5ndGggPCB0aGlzLm1heFByZWZpeGVzKCkgfHwgXHJcbiAgICAgICAgICAgICAgICAgICAgbW9kLmlzU3VmZml4KCkgJiYgdGhpcy5nZXRTdWZmaXhlcygpLmxlbmd0aCA8IHRoaXMubWF4U3VmZml4ZXMoKVxyXG4gICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9zdXBlcihtb2QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kfSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBvbiBzdWNjZXNzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYWRkSW1wbGljaXRzOiBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGxpY2l0cy5hZGRNb2QobW9kKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEl0ZW1JbXBsaWN0cyBmYXNjYWRlXHJcbiAgICAgICAgICogQHJldHVybnMge01vZENvbnRhaW5lckBjYWxsO3JlbW92ZUFsbE1vZHN9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmVtb3ZlQWxsSW1wbGljaXRzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGxpY2l0cy5yZW1vdmVBbGxNb2RzKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBJdGVtSW1wbGljaXRzIGZhc2NhZGVcclxuICAgICAgICAgKiBAcGFyYW0ge01vZH0gbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge01vZENvbnRhaW5lckBjYWxsO3JlbW92ZU1vZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICByZW1vdmVJbXBsaWNpdHM6IGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW1wbGljaXRzLnJlbW92ZU1vZChtb2QpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogSXRlbUltcGxpY2l0cyBmYXNjYWRlXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IHByaW1hcnlcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kQ29udGFpbmVyQGNhbGw7Z2V0TW9kfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldEltcGxpY2l0OiBmdW5jdGlvbiAocHJpbWFyeSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsaWNpdHMuZ2V0TW9kKHByaW1hcnkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogSXRlbUltcGxpY2l0cyBmYXNjYWRlXHJcbiAgICAgICAgICogQHBhcmFtIHtOdW1iZXJ9IHByaW1hcnlcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kQ29udGFpbmVyQGNhbGw7aW5Nb2RzfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluSW1wbGljaXRzOiBmdW5jdGlvbiAocHJpbWFyeSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pbXBsaWNpdHMuaW5Nb2RzKHByaW1hcnkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyBhIG5ldyB0YWcgdG8gdGhlIGl0ZW0gaWYgaXRzIG5vdCBhbHJlYWR5IHByZXNlblxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7aW50fSB0YWdfa2V5XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFkZFRhZzogZnVuY3Rpb24gKHRhZ19rZXkpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMudGFncy5pbmRleE9mKHRhZ19rZXkpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50YWdzLnB1c2godGFnX2tleSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiByZW1vdmVzIGFuIGV4aXN0aW5nIHRhZ1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7aW50fSB0YWdfa2V5XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlbW92ZVRhZzogZnVuY3Rpb24gKHRhZ19rZXkpIHtcclxuICAgICAgICAgICAgdmFyIGluZGV4ID0gdGhpcy50YWdzLmluZGV4T2YodGFnX2tleSk7XHJcbiAgICAgICAgICAgIGlmIChpbmRleCAhPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMudGFncyA9IHRoaXMudGFncy5zcGxpY2UoaW5kZXgsIDEpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhZ19rZXk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcmV0dXJucyB0YWdzIG9mIGl0ZW0gKyB0YWdzIGZyb20gbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRUYWdzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAkLnVuaXF1ZSh0aGlzLl9zdXBlcigpLmNvbmNhdCh0aGlzLm1ldGFfZGF0YS5wcm9wcy50YWdzLCB0aGlzLmVudHJ5LnZhbHVlQXNBcnJheShcIlRhZ3NLZXlzXCIpKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiByZXR1cm5zIHRoZSBtYXggcG9zc2libGUgbnVtYmVyIG9mIHRoZSBnaXZlbiBnZW5lcmF0aW9uIHR5cGVcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAb3ZlcnJpZGVcclxuICAgICAgICAgKiBAcGFyYW0ge01vZH0gbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn0gbWF4IG51bWJlciBvciAtMSBpZiBub3QgcG9zc2libGUgYXQgYWxsXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWF4TW9kc09mVHlwZTogZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICB2YXIgZ2VuZXJhdGlvbl90eXBlID0gK21vZC5nZXRQcm9wKFwiR2VuZXJhdGlvblR5cGVcIik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzd2l0Y2ggKGdlbmVyYXRpb25fdHlwZSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBNb2QuTU9EX1RZUEUuUFJFRklYOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1heFByZWZpeGVzKCk7XHJcbiAgICAgICAgICAgICAgICBjYXNlIE1vZC5NT0RfVFlQRS5TVUZGSVg6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubWF4U3VmZml4ZXMoKTtcclxuICAgICAgICAgICAgICAgIGNhc2UgTW9kLk1PRF9UWVBFLkVOQ0hBTlRNRU5UOlxyXG4gICAgICAgICAgICAgICAgY2FzZSBNb2QuTU9EX1RZUEUuVEFMSVNNQU46XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDE7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAtMTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG1heGltdW0gbnVtYmVyIG9mIHByZWZpeGVzXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge051bWJlcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXhQcmVmaXhlczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBzd2l0Y2ggKHRoaXMucmFyaXR5KSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLk5PUk1BTDpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gMDtcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuTUFHSUM6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDE7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLlJBUkU6XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLlNIT1dDQVNFOlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLm1ldGFfZGF0YS5pc0EoXCJBYnN0cmFjdEpld2VsXCIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAyO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gMztcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuVU5JUVVFOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG1heGltdW0gbnVtYmVyIG9mIHN1ZmZpeGVzICg9cHJlZml4ZXMpXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXhTdWZmaXhlczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tYXhQcmVmaXhlcygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZXF1aXYgbW9kIGRvbWFpblxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2QuRE9NQUlOLip9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbW9kRG9tYWluRXF1aXY6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubWV0YV9kYXRhLmlzQShcIkFic3RyYWN0SmV3ZWxcIikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBNb2QuRE9NQUlOLkpFV0VMO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1ldGFfZGF0YS5pc0EoXCJBYnN0cmFjdEZsYXNrXCIpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gTW9kLkRPTUFJTi5GTEFTSztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodGhpcy5tZXRhX2RhdGEuaXNBKFwiQWJzdHJhY3RNYXBcIikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBNb2QuRE9NQUlOLk1BUDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gTW9kLkRPTUFJTi5JVEVNO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY2hlY2tzIGlmIHRoZSBkb21haW5zIGFyZSBlcXVpdlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kLkRPTUFJTi4qfSBtb2RfZG9tYWluXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgaW4gZG9tYWluXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5Eb21haW5PZjogZnVuY3Rpb24gKG1vZF9kb21haW4pIHtcclxuICAgICAgICAgICAgc3dpdGNoIChtb2RfZG9tYWluKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIE1vZC5ET01BSU4uTUFTVEVSOlxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmluRG9tYWluT2YoTW9kLkRPTUFJTi5JVEVNKTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG1vZF9kb21haW4gPT09IHRoaXMubW9kRG9tYWluRXF1aXYoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZ2V0SW1wbGljaXRzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmltcGxpY2l0cy5hc0FycmF5KCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRBbGxNb2RzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFzQXJyYXkoKS5jb25jYXQodGhpcy5nZXRJbXBsaWNpdHMoKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBuYW1lIG9mIHRoZSBiYXNlX2l0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGJhc2VOYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnJhcml0eSA9PT0gSXRlbS5SQVJJVFkuTUFHSUMpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmVudHJ5LmdldFByb3AoXCJOYW1lXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWN0dWFsIGl0ZW0gbmFtZVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaXRlbU5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgc3dpdGNoICh0aGlzLnJhcml0eSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5NQUdJQzpcclxuICAgICAgICAgICAgICAgICAgICB2YXIgbmFtZSA9IFwiXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gcHJlZml4XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuZ2V0UHJlZml4ZXMoKS5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZSArPSB0aGlzLmdldFByZWZpeGVzKClbMF0uZ2V0UHJvcChcIk5hbWVcIikgKyBcIiBcIjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gKyBiYXNlX25hbWVcclxuICAgICAgICAgICAgICAgICAgICBuYW1lICs9IHRoaXMuZW50cnkuZ2V0UHJvcChcIk5hbWVcIik7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gKyBzdWZmaXhcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5nZXRTdWZmaXhlcygpLmxlbmd0aCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lICs9IFwiIFwiICsgdGhpcy5nZXRTdWZmaXhlcygpWzBdLmdldFByb3AoXCJOYW1lXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmFtZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuUkFSRTpcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yYW5kb21fbmFtZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBwcmltYXJ5IGtleVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcHJpbWFyeTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gK3RoaXMuZW50cnkuZ2V0UHJvcChcIlJvd3NcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiByZXF1aXJlbWVudHMgdG8gd2VhciB0aGlzIGl0ZW1cclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSByZXF1aXJlbWVudCBkZXNjID0+IGFtb3VudFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlcXVpcmVtZW50czogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgcmVxdWlyZW1lbnRzID0ge307XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAkLmVhY2goe1xyXG4gICAgICAgICAgICAgICAgTGV2ZWw6IHRoaXMucmVxdWlyZWRMZXZlbCgpLFxyXG4gICAgICAgICAgICAgICAgU3RyOiB0aGlzLmVudHJ5LmdldFByb3AoXCJSZXFTdHJcIiksXHJcbiAgICAgICAgICAgICAgICBEZXg6IHRoaXMuZW50cnkuZ2V0UHJvcChcIlJlcURleFwiKSxcclxuICAgICAgICAgICAgICAgIEludDogdGhpcy5lbnRyeS5nZXRQcm9wKFwiUmVxSW50XCIpXHJcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChrZXksIHJlcXVpcmVtZW50KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVxdWlyZW1lbnQgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVxdWlyZW1lbnRzW2tleV0gPSByZXF1aXJlbWVudDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gcmVxdWlyZW1lbnRzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVxdWlyZWRMZXZlbDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gTWF0aC5tYXguYXBwbHkoTWF0aCwgWyt0aGlzLmVudHJ5LmdldFByb3AoXCJEcm9wTGV2ZWxcIildLmNvbmNhdCgkLm1hcCh0aGlzLmdldEFsbE1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE1hdGguZmxvb3IoMC44ICogK21vZC5nZXRQcm9wKFwiTGV2ZWxcIikpO1xyXG4gICAgICAgICAgICB9KSkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc3RyaW5nIGlkZW50aWZpZXIgb2YgdGhlIGl0ZW1fY2xhc3NcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBrZXkgZnJvbSBAbGluayBJdGVtLklURU1DTEFTU0VTXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaXRlbWNsYXNzSWRlbnQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgICAgICByZXR1cm4gJC5tYXAoSXRlbS5JVEVNQ0xBU1NFUywgZnVuY3Rpb24gKGl0ZW1jbGFzcywgaWRlbnQpIHtcclxuICAgICAgICAgICAgICAgIGlmICgraXRlbWNsYXNzLlBSSU1BUlkgPT09ICt0aGF0LmVudHJ5LmdldFByb3AoXCJJdGVtQ2xhc3NcIikpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaWRlbnQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfSlbMF07XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzdHJpbmcgaWRlbnRpZmllciBvZiB0aGUgaXRlbSByYXJpdHlcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfSBrZXkgZnJvbSBAbGluayBJdGVtLlJBUklUWVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJhcml0eUlkZW50OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICAgICAgcmV0dXJuICQubWFwKEl0ZW0uUkFSSVRZLCBmdW5jdGlvbiAocmFyaXR5LCBpZGVudCkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHJhcml0eSA9PT0gK3RoYXQucmFyaXR5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlkZW50LnRvTG93ZXJDYXNlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfSlbMF07XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhdHRlbXB0cyB0byB1cGdyYWRlIHRoZSByYXJpdHlcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBvbiBjaGFuZ2UgaW4gcmFyaXR5XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgdXBncmFkZVJhcml0eTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBzd2l0Y2ggKHRoaXMucmFyaXR5KSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLk5PUk1BTDpcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuU0hPV0NBU0U6XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYXJpdHkgPSBJdGVtLlJBUklUWS5NQUdJQztcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgSXRlbS5SQVJJVFkuTUFHSUM6XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yYXJpdHkgPSBJdGVtLlJBUklUWS5SQVJFO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzdGF0cyBvZiBtb2RzIGNvbWJpbmVkXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gc3RhdF9pZCA9PiB2YWx1ZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHN0YXRzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciBzdGF0cyA9IHt9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gZmxhdHRlbiBtb2RzLnN0YXRzSm9pbmVkKClcclxuICAgICAgICAgICAgJC5lYWNoKCQubWFwKHRoaXMuYXNBcnJheSgpLmNvbmNhdCh0aGlzLmdldEltcGxpY2l0cygpKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5zdGF0c0pvaW5lZCgpO1xyXG4gICAgICAgICAgICB9KSwgZnVuY3Rpb24gKF8sIHN0YXQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBpZCA9IHN0YXQuZ2V0UHJvcChcIklkXCIpO1xyXG4gICAgICAgICAgICAgICAgLy8gZ3JvdXAgYnkgc3RhdC5JZFxyXG4gICAgICAgICAgICAgICAgaWYgKHN0YXRzW2lkXSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHN0YXRzW2lkXS52YWx1ZXMuYWRkKHN0YXQudmFsdWVzKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdHNbaWRdID0gc3RhdDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gc3RhdHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzdGF0cyBmcm9tIHRoZSBpdGVtIHdpdGggc3RhdHMgZnJvbSBtb2RzIGFwcGxpZWRcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7T2JqZWN0fSBkZXNjID0+IHZhbHVlcmFuZ2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBsb2NhbFN0YXRzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHZhciBzdGF0cyA9IHRoaXMuc3RhdHMoKTtcclxuICAgICAgICAgICAgdmFyIGxvY2FsX3N0YXRzID0ge307XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBUT0RPIHF1YWxpdHlcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLm1ldGFfZGF0YS5pc0EoJ0Fic3RyYWN0V2VhcG9uJykpIHtcclxuICAgICAgICAgICAgICAgIC8vIGFkZGVkIGZsYXRcclxuICAgICAgICAgICAgICAgICQuZWFjaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgXCJwaHlzaWNhbFwiOiAgbmV3IFZhbHVlUmFuZ2UoK3RoaXMuZW50cnkuZ2V0UHJvcChcIkRhbWFnZU1pblwiKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgK3RoaXMuZW50cnkuZ2V0UHJvcChcIkRhbWFnZU1heFwiKSksXHJcbiAgICAgICAgICAgICAgICAgICAgXCJmaXJlXCI6IG5ldyBWYWx1ZVJhbmdlKDAsIDApLFxyXG4gICAgICAgICAgICAgICAgICAgIFwiY29sZFwiOiBuZXcgVmFsdWVSYW5nZSgwLCAwKSxcclxuICAgICAgICAgICAgICAgICAgICBcImxpZ2h0bmluZ1wiOiBuZXcgVmFsdWVSYW5nZSgwLCAwKSxcclxuICAgICAgICAgICAgICAgICAgICBcImNoYW9zXCI6IG5ldyBWYWx1ZVJhbmdlKDAsIDApXHJcbiAgICAgICAgICAgICAgICB9LCBmdW5jdGlvbiAoc291cmNlLCBkYW1hZ2UpIHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHNbJ2xvY2FsX21pbmltdW1fYWRkZWRfJyArIHNvdXJjZSArICdfZGFtYWdlJ10pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGFtYWdlLm1pbiA9IHN0YXRzWydsb2NhbF9taW5pbXVtX2FkZGVkXycgKyBzb3VyY2UgKyAnX2RhbWFnZSddLnZhbHVlcy5hZGQoZGFtYWdlLm1pbik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSAgICAgXHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdGF0c1snbG9jYWxfbWF4aW11bV9hZGRlZF8nICsgc291cmNlICsgJ19kYW1hZ2UnXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYW1hZ2UubWF4ID0gc3RhdHNbJ2xvY2FsX21heGltdW1fYWRkZWRfJyArIHNvdXJjZSArICdfZGFtYWdlJ10udmFsdWVzLmFkZChkYW1hZ2UubWF4KTtcclxuICAgICAgICAgICAgICAgICAgICB9IFxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBUT0RPIGNvbWJpbmUgZWxlIGRhbWFnZVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghZGFtYWdlLmlzWmVybygpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsX3N0YXRzW3NvdXJjZS51Y2ZpcnN0KCkgKyAnIERhbWFnZSddID0gZGFtYWdlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPIGNvbWJpbmUgZWxlXHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIGFwcGx5IGluY3JlYXNlc1xyXG4gICAgICAgICAgICAgICAgbG9jYWxfc3RhdHNbJ1BoeXNpY2FsIERhbWFnZSddID0gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIEl0ZW0uYXBwbHlTdGF0KGxvY2FsX3N0YXRzWydQaHlzaWNhbCBEYW1hZ2UnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHNbJ2xvY2FsX3BoeXNpY2FsX2RhbWFnZV8rJSddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAwKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gQ3JpdFxyXG4gICAgICAgICAgICAgICAgbG9jYWxfc3RhdHNbJ0NyaXRpY2FsIFN0cmlrZSBDaGFuY2UnXSA9IFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBJdGVtLmFwcGx5U3RhdCgrdGhpcy5lbnRyeS5nZXRQcm9wKCdDcml0aWNhbCcpIC8gMTAwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdGF0c1snbG9jYWxfY3JpdGljYWxfc3RyaWtlX2NoYW5jZV8rJSddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAyKS50b1N0cmluZygpICsgXCIlXCI7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gQVBTXHJcbiAgICAgICAgICAgICAgICBsb2NhbF9zdGF0c1snQXR0YWNrcyBQZXIgU2Vjb25kJ10gPSBcclxuICAgICAgICAgICAgICAgICAgICAgICAgSXRlbS5hcHBseVN0YXQoMTAwMCAvICt0aGlzLmVudHJ5LmdldFByb3AoXCJTcGVlZFwiKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHNbJ2xvY2FsX2F0dGFja19zcGVlZF8rJSddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAyKTtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLm1ldGFfZGF0YS5pc0EoJ0Fic3RyYWN0QXJtb3VyJykpIHtcclxuICAgICAgICAgICAgICAgIHZhciB0aGF0ID0gdGhpcztcclxuICAgICAgICAgICAgICAgIC8vIGRlZmVuY2VzXHJcbiAgICAgICAgICAgICAgICAkLmVhY2goe1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIENvbXBvbmVudEFybW91ciA9PiBzdGF0X25hbWVcclxuICAgICAgICAgICAgICAgICAgICBBcm1vdXI6IFwicGh5c2ljYWxfZGFtYWdlX3JlZHVjdGlvblwiLFxyXG4gICAgICAgICAgICAgICAgICAgIEV2YXNpb246IFwiZXZhc2lvblwiLFxyXG4gICAgICAgICAgICAgICAgICAgIEVuZXJneVNoaWVsZDogXCJlbmVyZ3lfc2hpZWxkXCJcclxuICAgICAgICAgICAgICAgIH0sIGZ1bmN0aW9uIChjb21wb25lbnQsIHN0YXQpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBpbml0YWwgdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICBsb2NhbF9zdGF0c1tjb21wb25lbnRdID0gbmV3IFZhbHVlUmFuZ2UoK3RoYXQuZW50cnkuZ2V0UHJvcChjb21wb25lbnQpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArdGhhdC5lbnRyeS5nZXRQcm9wKGNvbXBvbmVudCkpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIGFkZGVkIGZsYXRcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdHNbJ2xvY2FsX2Jhc2VfJyArIHN0YXQgKyAnX3JhdGluZyddKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsX3N0YXRzW2NvbXBvbmVudF0gPSBsb2NhbF9zdGF0c1tjb21wb25lbnRdLmFkZChzdGF0c1snbG9jYWxfYmFzZV8nICsgc3RhdCArICdfcmF0aW5nJ10udmFsdWVzKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gaW5jcmVhc2VcclxuICAgICAgICAgICAgICAgICAgICBsb2NhbF9zdGF0c1tjb21wb25lbnRdID0gXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBJdGVtLmFwcGx5U3RhdChsb2NhbF9zdGF0c1tjb21wb25lbnRdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHNbJ2xvY2FsXycgKyBzdGF0ICsgJ19yYXRpbmdfKyUnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDApO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChsb2NhbF9zdGF0c1tjb21wb25lbnRdLmlzWmVybygpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBsb2NhbF9zdGF0c1tjb21wb25lbnRdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBUT0RPIGNvbG9yIHN0YXRzXHJcbiAgICAgICAgICAgIHJldHVybiBsb2NhbF9zdGF0cztcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiB0YWtlcyBhIGluY3JlYXNlZCBzdGF0IGFuZCBhcHBsaWVzIGl0IHRvIHRoZSB2YWx1ZVxyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge1ZhbHVlUmFuZ2V8TnVtYmVyfSB2YWx1ZVxyXG4gICAgICogQHBhcmFtIHtTdGF0fSBzdGF0XHJcbiAgICAgKiBAcGFyYW0ge051bWJlcn0gcHJlY2lzaW9uXHJcbiAgICAgKiBAcmV0dXJucyB7VmFsdWVSYW5nZX1cclxuICAgICAqL1xyXG4gICAgSXRlbS5hcHBseVN0YXQgPSBmdW5jdGlvbiAodmFsdWUsIHN0YXQsIHByZWNpc2lvbikge1xyXG4gICAgICAgIHZhciByZXN1bHQgPSBudWxsO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChzdGF0ID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICByZXN1bHQgPSB2YWx1ZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyAxMDAlIGluY3JlYXNlZCA6PSAyID0gKDEwMCUgLyAxMDApICsgMVxyXG4gICAgICAgICAgICB2YXIgbXVsdGlwbGllciA9IHN0YXQudmFsdWVzLm11bHRpcGx5KDEgLyAxMDApLmFkZCgxKTtcclxuXHJcblxyXG4gICAgICAgICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBWYWx1ZVJhbmdlKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSB2YWx1ZS5tdWx0aXBseShtdWx0aXBsaWVyKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG11bHRpcGxpZXIubXVsdGlwbHkodmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiByZXN1bHQudG9GaXhlZChwcmVjaXNpb24pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBtZXRhIGRhdGEgb2JqZWN0IHVuaW5pdGlhbGl6ZWRcclxuICAgICAqL1xyXG4gICAgSXRlbS5tZXRhX2RhdGEgPSBudWxsO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGFsbCBwb3NzaWJsZSByYXJpdGllc1xyXG4gICAgICovXHJcbiAgICBJdGVtLlJBUklUWSA9IHtcclxuICAgICAgICBOT1JNQUw6IDEsXHJcbiAgICAgICAgTUFHSUM6IDIsXHJcbiAgICAgICAgUkFSRTogMyxcclxuICAgICAgICBVTklRVUU6IDQsXHJcbiAgICAgICAgU0hPV0NBU0U6IDVcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogbWF4aW11bSBpdGVtIGxldmVsXHJcbiAgICAgKi9cclxuICAgIEl0ZW0uTUFYX0lMVkwgPSAxMDA7XHJcbiAgICBcclxuICAgIC8qIHRhZ3MgYXJlIG9ic29sdGUuIHRoZXkgYXJlIGRlcml2YXRlZCBmcm9tIHRoZSBpbmhlcml0YW5jZSBjaGFpblxyXG4gICAgICogdGhleSBhcmUga2VwdCBmb3IgaGlzdG9yaWMgcmVhc29ucyAqL1xyXG4gICAgSXRlbS5JVEVNQ0xBU1NFUyA9IHtcclxuICAgICAgICBBTVVMRVQ6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogNSwgXHJcbiAgICAgICAgICAgIC8vIGFtdWxldCwgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMywgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFJJTkc6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogNiwgXHJcbiAgICAgICAgICAgIC8vIHJpbmcsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzIsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBDTEFXOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDcsIFxyXG4gICAgICAgICAgICAvLyBjbGF3LCBvbmVoYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzE0LCA4MSwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIERBR0dFUjogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogOCwgXHJcbiAgICAgICAgICAgIC8vIGRhZ2dlciwgb25laGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxMywgODEsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBXQU5EOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiA5LCBcclxuICAgICAgICAgICAgLy8gd2FuZCwgb25laGFuZHdlYXBvbiwgd2VhcG9uLCByYW5nZWRcclxuICAgICAgICAgICAgVEFHUzogWzksIDgxLCA4LCAzMl1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFNXT1JEXzFIOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiAxMCwgXHJcbiAgICAgICAgICAgIC8vIHN3b3JkLCBvbmVoYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzEyLCA4MSwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFRIUlVTVElOR19TV09SRF8xSDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAxMSwgXHJcbiAgICAgICAgICAgIC8vIHN3b3JkLCBvbmVoYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzEyLCA4MSwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEFYRV8xSDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAxMiwgXHJcbiAgICAgICAgICAgIC8vIGF4ZSwgb25laGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxNSwgODEsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBNQUNFXzFIOiB7IFxyXG4gICAgICAgICAgICBQUklNQVJZOiAxMywgXHJcbiAgICAgICAgICAgIC8vIG1hY2UsIG9uZWhhbmR3ZWFwb24sIHdlYXBvblxyXG4gICAgICAgICAgICBUQUdTOiBbMTEsIDgxLCA4XVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQk9XOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDE0LFxyXG4gICAgICAgICAgICAvLyBib3csIHR3b2hhbmR3ZWFwb24sIHdlYXBvbiwgcmFuZ2VkXHJcbiAgICAgICAgICAgIFRBR1M6IFs1LCA4MiwgOCwgMzJdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTVEFGRjogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogMTUsIFxyXG4gICAgICAgICAgICAvLyBTdGFmZiwgdHdvaGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxMCwgODIsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTV09SRF8ySDogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogMTYsIFxyXG4gICAgICAgICAgICAvLyBzd29yZCwgdHdvaGFuZHdlYXBvbiwgd2VhcG9uXHJcbiAgICAgICAgICAgIFRBR1M6IFsxMiwgODIsIDhdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBBWEVfMkg6IHsgXHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDE3LCBcclxuICAgICAgICAgICAgLy8gYXhlLCB0d29oYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzE1LCA4MiwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIE1BQ0VfMkg6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMTgsIFxyXG4gICAgICAgICAgICAvLyBtYWNlLCB0d29oYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzExLCA4MiwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFFVSVZFUjoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAyMSwgXHJcbiAgICAgICAgICAgIC8vIHF1aXZlciwgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMjEsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBCRUxUOiB7XHJcbiAgICAgICAgICAgIFBSSU1BUlk6IDIyLCBcclxuICAgICAgICAgICAgLy8gYmVsdCwgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMjYsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBHTE9WRVM6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMjMsIFxyXG4gICAgICAgICAgICAvLyBnbG92ZXMsIGFybW91ciwgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMjIsIDcsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBCT09UUzoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAyNCwgXHJcbiAgICAgICAgICAgIC8vIGJvb3RzLCBhcm1vdXIsIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzQsIDcsIDBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBBUk1PVVI6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMjUsIFxyXG4gICAgICAgICAgICAvLyBib2R5X2FybW91ciwgYXJtb3VyLCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFsxNiwgNywgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIEhFTE1FVDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAyNiwgXHJcbiAgICAgICAgICAgIC8vIGhlbG1ldCwgYXJtb3VyLCBkZWZhdWx0XHJcbiAgICAgICAgICAgIFRBR1M6IFsyNSwgNywgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFNISUVMRDogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogMjcsIFxyXG4gICAgICAgICAgICAvLyBzaGllbGQsIGFybW91ciwgZGVmYXVsdFxyXG4gICAgICAgICAgICBUQUdTOiBbMSwgNywgMF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFNDRVBUUkU6IHtcclxuICAgICAgICAgICAgUFJJTUFSWTogMzMsIFxyXG4gICAgICAgICAgICAvLyBzY2VwdHJlLCBvbmVoYW5kd2VhcG9uLCB3ZWFwb25cclxuICAgICAgICAgICAgVEFHUzogWzM3LCA4MSwgOF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIE1BUDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAzNiwgXHJcbiAgICAgICAgICAgIC8vIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBGSVNISU5HX1JPRDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiAzOCwgXHJcbiAgICAgICAgICAgIC8vIGZpc2hpbmdfcm9kXHJcbiAgICAgICAgICAgIFRBR1M6IFs4MF1cclxuICAgICAgICB9LFxyXG4gICAgICAgIE1BUF9GUkFHTUVOVDogeyBcclxuICAgICAgICAgICAgUFJJTUFSWTogMzksXHJcbiAgICAgICAgICAgIFRBR1M6IFtdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBKRVdFTDoge1xyXG4gICAgICAgICAgICBQUklNQVJZOiA0MiwgXHJcbiAgICAgICAgICAgIC8vIGRlZmF1bHRcclxuICAgICAgICAgICAgVEFHUzogWzBdXHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBJdGVtO1xyXG59KS5jYWxsKHRoaXMpO1xyXG5cclxuIiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIE1vZENvbnRhaW5lciA9IHJlcXVpcmUoXCIuL01vZENvbnRhaW5lclwiKTtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01vZCcpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEl0ZW1JbXBsaWNpdHMgZXh0ZW5kcyBNb2RDb250YWluZXJcclxuICAgICAqIFxyXG4gICAgICogaG9sZHMgYWxsIGltcGxpY2l0cyBmb3IgaXRlbXNcclxuICAgICAqL1xyXG4gICAgdmFyIEl0ZW1JbXBsaWNpdHMgPSBNb2RDb250YWluZXIuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge01vZH0gbW9kXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFkZE1vZDogZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBpZiAoIShtb2QgaW5zdGFuY2VvZiBNb2QpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmhhc1Jvb21Gb3IobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3N1cGVyKG1vZCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2R9IG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IC0xIGlmIG5vdCBwb3NzaWJsZSBhdCBhbGxcclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXhNb2RzT2ZUeXBlOiBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgIGlmICAoK21vZC5nZXRQcm9wKFwiR2VuZXJhdGlvblR5cGVcIikgPT09IE1vZC5NT0RfVFlQRS5QUkVNQURFKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gNTtcclxuICAgICAgICAgICAgfSBcclxuICAgICAgICAgICAgcmV0dXJuIC0xO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEl0ZW1JbXBsaWNpdHM7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgJ3VzZSBzdHJpY3QnO1xyXG4gICAgXHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKFwiLi4vSW5oZXJpdGFuY2VcIik7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZShcIi4uL21vZHMvTW9kXCIpO1xyXG4gICAgXHJcbiAgICBpZiAoJCA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvKlxyXG4gICAgICogTW9kQ29udGFpbmVyIGNsYXNzXHJcbiAgICAgKiBcclxuICAgICAqIENvbnRhaW5lciBmb3IgQGxpbmsgTW9kXHJcbiAgICAgKi9cclxuICAgIHZhciBNb2RDb250YWluZXIgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZHMgYWxsIG1vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7TW9kQ29udGFpbmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChtb2RzKSB7XHJcbiAgICAgICAgICAgIGlmIChtb2RzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RzID0gW107XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1vZHMgPSBtb2RzO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICAgKiBAdmFyIHRoaXMubW9kcyBBcnJheTxNb2Q+XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy50YWdzID0gW107XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIGEgbmV3IG5vbi1leGlzdGluZyBtb2RcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge01vZH0gbmV3X21vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIHN1Y2Nlc3NcclxuICAgICAgICAgKi9cclxuICAgICAgICBhZGRNb2Q6IGZ1bmN0aW9uIChuZXdfbW9kKSB7XHJcbiAgICAgICAgICAgIGlmICghKG5ld19tb2QgaW5zdGFuY2VvZiBNb2QpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdtb2QgbXVzdCBiZSBpbnN0YW5jZSBvZiBgTW9kYCcpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmluTW9kcyhuZXdfbW9kLmdldFByb3AoXCJSb3dzXCIpKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMubW9kcy5wdXNoKG5ld19tb2QpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogdHJ1bmNhdGVzIG1vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7dm9pZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICByZW1vdmVBbGxNb2RzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMubW9kcyA9IFtdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcmVtb3ZlcyBhbiBleGlzdGluZyBtb2RcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IG9sZF9tb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfEJvb2xlYW59IGZhbHNlIGlmIG5vbi1leGlzdGluZ1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlbW92ZU1vZDogZnVuY3Rpb24gKG9sZF9tb2QpIHsgIFxyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSB0aGlzLmluTW9kcyhvbGRfbW9kLmdldFByb3AoXCJSb3dzXCIpKTtcclxuICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5tb2RzLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaW5kZXg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ2V0cyBhIG1vZCBieSBwcmltYXJ5XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBwcmltYXJ5XHJcbiAgICAgICAgICogQHJldHVybnMge01vZH0gbnVsbCBpZiBub3QgZXhpc3RpbmdcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRNb2Q6IGZ1bmN0aW9uIChwcmltYXJ5KSB7XHJcbiAgICAgICAgICAgIHZhciBpbmRleCA9IHRoaXMuaW5Nb2RzKHByaW1hcnkpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGluZGV4ICE9PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kc1tpbmRleF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBjaGVja3MgaWYgYSBtb2QgaXMgaW4gdGhlIGNvbnRhaW5lclxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBwcmltYXJ5IHByaW1hcnkgb2YgdGhlIG1vZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9IGluZGV4IG9mIHRoZSBtb2RzXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5Nb2RzOiBmdW5jdGlvbiAocHJpbWFyeSkge1xyXG4gICAgICAgICAgICB2YXIgaW5kZXggPSAtMTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICQuZWFjaCh0aGlzLm1vZHMsIGZ1bmN0aW9uIChpLCBtb2QpIHtcclxuICAgICAgICAgICAgICAgIGlmICgrbW9kLmdldFByb3AoXCJSb3dzXCIpID09PSArcHJpbWFyeSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGluZGV4ID0gaTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGluZGV4O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogcmV0dXJucyB0YWdzIG9mIHRoZSBtb2RzIGluIHRoZSBjb250YWluZXJcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0VGFnczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAvLyBqUXVlcnkgbWFwIGFscmVhZHkgZmxhdHRlbnNcclxuICAgICAgICAgICAgcmV0dXJuICQudW5pcXVlKCQubWFwKHRoaXMubW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC52YWx1ZUFzQXJyYXkoXCJUYWdzS2V5c1wiKTtcclxuICAgICAgICAgICAgfSkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogaW50ZXJzZWN0cyBhbGwgdGFncyB3aXRoIHRoZSBvbmVzIG9uIHRoZSBpdGVtXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX3RhZ3NcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9IHRhZ3MgZnJvbSB0aGUgaXRlbSB3aXRoIHRoZWlyIHByb3BlcnRpZXNcclxuICAgICAgICAgKi9cclxuICAgICAgICBnZXRUYWdzV2l0aFByb3BzOiBmdW5jdGlvbiAoYWxsX3RhZ3MpIHtcclxuICAgICAgICAgICAgdmFyIHRhZ3MgPSB0aGlzLmdldFRhZ3MoKTtcclxuICAgICAgICAgICAgcmV0dXJuICQuZ3JlcChhbGxfdGFncywgZnVuY3Rpb24gKHRhZ19wcm9wcykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhZ3MuaW5kZXhPZigrdGFnX3Byb3BzLlJvd3MpICE9PSAtMTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhbGwgcHJlZml4IG1vZHNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0UHJlZml4ZXM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICQuZ3JlcCh0aGlzLm1vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2QuaXNQcmVmaXgoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhbGwgc3VmZml4IG1vZHNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0U3VmZml4ZXM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICQuZ3JlcCh0aGlzLm1vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2QuaXNTdWZmaXgoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzdWZmaXhlcyBhbmQgcHJlZml4ZXNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgZ2V0QWZmaXhlczogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAvLyByYXRoZXIgb3JkZXIgdGhlIG1vZHMgdGhhbiBtaXggZW0gdXBcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UHJlZml4ZXMoKS5jb25jYXQodGhpcy5nZXRTdWZmaXhlcygpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFsbCBtb2RzIFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFzQXJyYXk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBtb2RfdHlwZSBzZWFyY2hlZCBHZW5lcmF0aW9uVHlwZVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtOdW1iZXJ9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbnVtYmVyT2ZNb2RzT2ZUeXBlOiBmdW5jdGlvbiAobW9kX3R5cGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuICQuZ3JlcCh0aGlzLm1vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiArbW9kLmdldFByb3AoXCJHZW5lcmF0aW9uVHlwZVwiKSA9PT0gbW9kX3R5cGU7XHJcbiAgICAgICAgICAgIH0pLmxlbmd0aDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGNoZWNrcyBpZiB0aGVyZXMgbW9yZSBwbGFjZSBmb3IgYSBtb2Qgd2l0aCB0aGVpciBnZW5lcmF0aW9udHlwZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kfSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn0gdHJ1ZSBpZiByb29tIGZvclxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGhhc1Jvb21Gb3I6IGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubnVtYmVyT2ZNb2RzT2ZUeXBlKCttb2QuZ2V0UHJvcChcIkdlbmVyYXRpb25UeXBlXCIpKSA8IHRoaXMubWF4TW9kc09mVHlwZShtb2QpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGFic3RyYWN0XHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBtb2RcclxuICAgICAgICAgKiBAcmV0dXJucyB7TnVtYmVyfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1heE1vZHNPZlR5cGU6IGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJvdmVycmlkZSBhYnN0cmFjdCBtYXhNb2RzT2ZUeXBlXCIpO1xyXG4gICAgICAgICAgICByZXR1cm4gLTE7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7IFxyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZENvbnRhaW5lcjtcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBqc2hpbnQgYml0d2lzZTogZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDdXJyZW5jeSA9IHJlcXVpcmUoJy4vQ3VycmVuY3knKTtcclxuICAgIHZhciBUcmFuc211dGUgPSByZXF1aXJlKCcuL1RyYW5zbXV0ZScpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgQWxjaGVteSBleHRlbmRzIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBPcmIgb2YgQWxjaGVteVxyXG4gICAgICogbW9kIGdlbmVyYXRpb24gbW9zdCBsaWtlbHkgbm90IGFjY3VyYXRlIGJlY2F1c2Ugd2UganVzdCByb2xsIDQtNiBtb2RzXHJcbiAgICAgKiBhbmQgY29ycmVsYXRlICNwcmVmaXhzL3N1ZmZpeGVzIHRvIGVhY2hlIG90aGVyIGlmIHRoZSByYXRpbyA+PSAzOjFcclxuICAgICAqL1xyXG4gICAgdmFyIEFsY2hlbXkgPSBDdXJyZW5jeS5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7QWxjaGVteX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiQWxjaGVteVwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyA0LTZcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoaXRlbSkge1xyXG4gICAgICAgICAgICB2YXIgaTtcclxuICAgICAgICAgICAgdmFyIG5ld19tb2RzO1xyXG4gICAgICAgICAgICB2YXIgcHJlZml4ZXMsIHN1ZmZpeGVzO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAvLyB1cGdyYWRlIHRvIHJhcmVcclxuICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuUkFSRTtcclxuXHJcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAxLCBuZXdfbW9kcyA9IE1hdGgucmFuZCg0LCA2KTsgaSA8PSBuZXdfbW9kczsgKytpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBwcmVmaXhlcyA9IGl0ZW0uZ2V0UHJlZml4ZXMoKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBzdWZmaXhlcyA9IGl0ZW0uZ2V0U3VmZml4ZXMoKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIGNvcnJlY3QgZGlmZmVyZW5jZXMgYmV0d2VlbiAjcHJlZml4ZXMsICNzdWZmaXhlcyA+PSAyXHJcbiAgICAgICAgICAgICAgICBmb3IgKGkgPSAxLCBuZXdfbW9kcyA9IE1hdGgubWF4KDAsIE1hdGguYWJzKHByZWZpeGVzIC0gc3VmZml4ZXMpIC0gMSk7IGkgPD0gbmV3X21vZHM7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0uYWRkTW9kKHRoaXMuY2hvb3NlTW9kKGl0ZW0pKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG1hcHMgbW9kOjphcHBsaWNhYmxlVG8gYXMgaWYgaXQgd2VyZSBhbHJlYWR5IG1hZ2ljXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXA6IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIC8vIHNpbXVsYXRlIHVwZ3JhZGVcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5SQVJFO1xyXG4gICAgICAgICAgICB2YXIgbW9kcyA9IHRoaXMuX3N1cGVyKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdyZXBzIG1vZDo6YXBwbGljYWJsZVRvIGFzIGlmIGl0IHdlcmUgYWxyZWFkeSByYXJlXHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHt0eXBlfSBzdWNjZXNzXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIC8vIHNpbXVsYXRlIHVwZ3JhZGVcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5SQVJFO1xyXG4gICAgICAgICAgICB2YXIgbW9kcyA9IHRoaXMuX3N1cGVyKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgU1VDQ0VTUyBieXRlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlICY9IH5BcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtLnJhcml0eSAhPT0gSXRlbS5SQVJJVFkuTk9STUFMKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBbGNoZW15LkFQUExJQ0FCTEVfQllURS5OT1RfV0hJVEU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5hcHBsaWNhYmxlX2J5dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsY2hlbXkuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQWxjaGVteS5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiQWxjaGVteS5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEFsY2hlbXkuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfV0hJVEU6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gQWxjaGVteTtcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gcmVxdWlyZSgnLi9DdXJyZW5jeScpO1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IHJlcXVpcmUoJy4vVHJhbnNtdXRlJyk7XHJcbiAgICB2YXIgSXRlbSA9IHJlcXVpcmUoJy4uL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICBcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBBdWdtZW50IGV4dGVuZHMgQ3VycmVuY3lcclxuICAgICAqIFxyXG4gICAgICogcmVwcmVzYW50YXRpb24gb2YgT3JiIG9mIEF1Z21lbnRhdGlvblxyXG4gICAgICovXHJcbiAgICB2YXIgQWx0ZXJhdGlvbiA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7QWx0ZXJhdGlvbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiQWx0ZXJhdGlvblwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyBvbmUgcmFuZG9tIHByb3BlcnR5XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IEBsaW5rIEl0ZW06OmFkZE1vZFxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChpdGVtKSB7IFxyXG4gICAgICAgICAgICBpZiAodGhpcy5hcHBsaWNhYmxlVG8oaXRlbSkpIHtcclxuICAgICAgICAgICAgICAgIC8vIFRPRE8gYWN0dWFsbHkgY29uc2lkZXJzICpfY2Fubm90X2JlX2NoYW5nZWQ/XHJcbiAgICAgICAgICAgICAgICAvLyBncmFudGVkIHZpYSBzY291cmluZyBidXQgaXMgdGhpcyB0cnVlIGZvciBpbmdhbWUgYWx0cz9cclxuICAgICAgICAgICAgICAgIG5ldyBTY291cmluZygpLmFwcGx5VG8oaXRlbSk7XHJcbiAgICAgICAgICAgICAgICAvLyBubyBjb21wbGV0ZSBzY291cj9cclxuICAgICAgICAgICAgICAgIGlmICghKG5ldyBUcmFuc211dGUodGhpcy5hdmFpbGFibGVfbW9kcykuYXBwbHlUbyhpdGVtKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBuZXcgQXVnbWVudCh0aGlzLmF2YWlsYWJsZV9tb2RzKS5hcHBseVRvKGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogaXRlbSBuZWVkcyB0byBiZSBtYWdpY1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge0J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgU1VDQ0VTUyBieXRlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlICY9IH5BcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtLnJhcml0eSAhPT0gSXRlbS5SQVJJVFkuTUFHSUMpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IEFsdGVyYXRpb24uQVBQTElDQUJMRV9CWVRFLk5PVF9NQUdJQztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEFsdGVyYXRpb24uQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQWx0ZXJhdGlvbi5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiQWx0ZXJhdGlvbi5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEFsdGVyYXRpb24uQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfTUFHSUM6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gQWx0ZXJhdGlvbjtcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gcmVxdWlyZSgnLi9DdXJyZW5jeScpO1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IHJlcXVpcmUoJy4vVHJhbnNtdXRlJyk7XHJcbiAgICB2YXIgSXRlbSA9IHJlcXVpcmUoJy4uL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICBcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgQXVnbWVudCBleHRlbmRzIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIHJlcHJlc2FudGF0aW9uIG9mIE9yYiBvZiBBdWdtZW50YXRpb25cclxuICAgICAqL1xyXG4gICAgdmFyIEF1Z21lbnQgPSBDdXJyZW5jeS5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBjb25zdHJ1Y3RvclxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge0F1Z21lbnR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBUcmFuc211dGUubW9kX2ZpbHRlcik7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIkF1Z21lbnRcIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgb25lIHJhbmRvbSBwcm9wZXJ0eVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBAbGluayBJdGVtOjphZGRNb2RcclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoaXRlbSkgeyBcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBpdGVtIG5lZWRzIHRvIGJlIG1hZ2ljXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Qnl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW0ucmFyaXR5ICE9PSBJdGVtLlJBUklUWS5NQUdJQykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQXVnbWVudC5BUFBMSUNBQkxFX0JZVEUuTk9UX01BR0lDO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQXVnbWVudC5BUFBMSUNBQkxFX0JZVEUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBBdWdtZW50LkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJBdWdtZW50LmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgQXVnbWVudC5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgLy8gQ3VycmVuY3lcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsXHJcbiAgICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgICBOT1RfQU5fSVRFTTogMixcclxuICAgICAgICAvLyBleHRlbmRlZFxyXG4gICAgICAgIE5PVF9NQUdJQzogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBBdWdtZW50O1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgVHJhbnNtdXRlID0gcmVxdWlyZSgnLi9UcmFuc211dGUnKTtcclxuICAgIHZhciBBbGNoZW15ID0gcmVxdWlyZSgnLi9BbGNoZW15Jyk7XHJcbiAgICB2YXIgU2NvdXJpbmcgPSByZXF1aXJlKCcuL1Njb3VyaW5nJyk7XHJcbiAgICB2YXIgRXhhbHRlZCA9IHJlcXVpcmUoJy4vRXhhbHRlZCcpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgQ2hhb3MgZXh0ZW5kcyBDdXJyZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiByZXByZXNhbnRhdGlvbiBvZiBDaGFvcyBPcmJcclxuICAgICAqL1xyXG4gICAgdmFyIENoYW9zID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtDaGFvc31cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiQ2hhb3NcIjtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFkZHMgb25lIHJhbmRvbSBwcm9wZXJ0eVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSBAbGluayBJdGVtOjphZGRNb2RcclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoaXRlbSkgeyBcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBUT0RPIGFjdHVhbGx5IGNvbnNpZGVycyAqX2Nhbm5vdF9iZV9jaGFuZ2VkP1xyXG4gICAgICAgICAgICAgICAgLy8gZ3JhbnRlZCB2aWEgc2NvdXJpbmcgYnV0IGlzIHRoaXMgdHJ1ZSBmb3IgaW5nYW1lIGFsdHM/XHJcbiAgICAgICAgICAgICAgICBuZXcgU2NvdXJpbmcoKS5hcHBseVRvKGl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgLy8gbm8gY29tcGxldGUgc2NvdXI/XHJcbiAgICAgICAgICAgICAgICBpZiAoIShuZXcgQWxjaGVteSh0aGlzLmF2YWlsYWJsZV9tb2RzKS5hcHBseVRvKGl0ZW0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFRPRE8gY29ycmVsYXRlIGNvdW50XHJcbiAgICAgICAgICAgICAgICAgICAgbmV3IEV4YWx0ZWQodGhpcy5hdmFpbGFibGVfbW9kcykuYXBwbHlUbyhpdGVtKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGl0ZW0gbmVlZHMgdG8gYmUgcmFyZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge0J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICAvLyByZW1vdmUgU1VDQ0VTUyBieXRlXHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlICY9IH5BcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGJhc2VpdGVtLnJhcml0eSAhPT0gSXRlbS5SQVJJVFkuUkFSRSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQ2hhb3MuQVBQTElDQUJMRV9CWVRFLk5PVF9SQVJFO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2hhb3MuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgQ2hhb3MuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIkNoYW9zLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgQ2hhb3MuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfUkFSRTogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBDaGFvcztcclxufSkuY2FsbCh0aGlzKTsiLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIE1vZEdlbmVyYXRvciA9IHJlcXVpcmUoJy4vTW9kR2VuZXJhdG9yJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIHZhciBSb2xsYWJsZU1vZCA9IHJlcXVpcmUoJy4uL21vZHMvUm9sbGFibGVNb2QnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yRmFjdG9yeSA9IHJlcXVpcmUoJy4uL01vZEdlbmVyYXRvcnMvTW9kR2VuZXJhdG9yRmFjdG9yeScpO1xyXG4gICAgXHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogYWJzdHJhY3QgY2xhc3MgQ3VycmVuY3kgZXh0ZW5kcyBNb2RHZW5lcmF0b3JcclxuICAgICAqIFxyXG4gICAgICogYWJzdHJhY3QgcmVwcmVzZW50YXRpb24gb2YgaW5nYW1lIGN1cnJlbmN5IHdoaWNoIG9ubHkgYWNjZXB0c1xyXG4gICAgICogcHJlZml4ZXMsIHN1ZmZpeGVzIGFuZCBpbXBsaWNpdHNcclxuICAgICAqL1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gTW9kR2VuZXJhdG9yLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBhbmRfZmlsdGVyIGFkZGl0aW9uYWwgZmlsdGVyIGZ1bmN0aW9uIGZvciAkLm1hcFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtNb2RHZW5lcmF0b3J9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzLCBhbmRfZmlsdGVyKSB7XHJcbiAgICAgICAgICAgIGlmIChhbmRfZmlsdGVyID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgLy8gZHVtbXkgZmlsdGVyXHJcbiAgICAgICAgICAgICAgICBhbmRfZmlsdGVyID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdHJ1ZTsgfTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFJvbGxhYmxlTW9kLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLlNwYXduV2VpZ2h0X1RhZ3NLZXlzICE9PSBcIlwiICYmIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBhbmRfZmlsdGVyKG1vZCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGFic3RyYWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtNb2RDb250YWluZXJ9IG1vZF9jb250YWluZXJcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBtYXBzIE1vZDo6YXBwbGljYWJsZVRvIGFuZCBNb2Q6OnNwYXduYWJsZU9uIHRvIGFsbCBhdmFpbGFibGUgbW9kc1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICByZXR1cm4gJC5tYXAodGhpcy5nZXRBdmFpbGFibGVNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIG1vZC5hcHBsaWNhYmxlVG8oaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgICAgICBtb2Quc3Bhd25hYmxlT24oaXRlbSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2Q7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ3JlcHMgTW9kOjphcHBsaWNhYmxlVG8gYW5kIE1vZDo6c3Bhd25hYmxlT24gdG8gYWxsIGF2YWlsYWJsZSBtb2RzXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzXHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAkLmdyZXAodGhpcy5nZXRBdmFpbGFibGVNb2RzKCksIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2QuYXBwbGljYWJsZVRvKGl0ZW0sIHN1Y2Nlc3MpICYmIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2Quc3Bhd25hYmxlT24oaXRlbSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY3VycmVuY3kgb25seSBhcHBsaWVzIHRvIGl0ZW1zXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2RDb250YWluZXJ9IG1vZF9jb250YWluZXJcclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZVRvOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lciwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLnJlc2V0QXBwbGljYWJsZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHN1Y2Nlc3MgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzID0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghKG1vZF9jb250YWluZXIgaW5zdGFuY2VvZiBJdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gQ3VycmVuY3kuQVBQTElDQUJMRV9CWVRFLk5PVF9BTl9JVEVNO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzZXRzIHRoZSBjbGFzcyBiYWNrIHRvIHVuc2Nhbm5lZFxyXG4gICAgICAgICAqIEByZXR1cm5zIHt2b2lkfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHJlc2V0QXBwbGljYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBDdXJyZW5jeS5BUFBMSUNBQkxFX0JZVEUsIEN1cnJlbmN5LkFQUExJQ0FCTEVfQllURS5TVUNDRVNTKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUNhY2hlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBBcHBsaWNhYmxlLlNVQ0NFU1MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIC8vIGdyZXAgb2JqZWN0XHJcbiAgICAgICAgICAgIHJldHVybiAkLm1hcChNb2RHZW5lcmF0b3JGYWN0b3J5LkdFTkVSQVRPUlMsIGZ1bmN0aW9uIChwcm9wcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHByb3BzLmtsYXNzID09PSB0aGF0LmtsYXNzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHByb3BzLm5hbWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgfSlbMF0gfHwgXCJBYnN0cmFjdEN1cnJlbmN5XCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEN1cnJlbmN5LkFQUExJQ0FCTEVfQllURSA9IHtcclxuICAgICAgICAvLyBDb252ZW50aW9uIG9mIEFwcGxpY2FibGVcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsXHJcbiAgICAgICAgU1VDQ0VTUzogMSxcclxuICAgICAgICAvLyBDdXJyZW5jeVxyXG4gICAgICAgIE5PVF9BTl9JVEVNOiAyXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEN1cnJlbmN5O1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcbiAgICB2YXIgTW9kR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9Nb2RHZW5lcmF0b3InKTtcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcbiAgICB2YXIgUm9sbGFibGVNb2QgPSByZXF1aXJlKCcuLi9tb2RzL1JvbGxhYmxlTW9kJyk7XG4gICAgXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBjbGFzcyBFbmNoYW50bWVudEJlbmNoIGV4dGVuZHMgTW9kR2VuZXJhdG9yXG4gICAgICogXG4gICAgICogaW5nYW1lIHJlcHJlc2VudGF0aW9uIG9mIGEgZW5jaGFudG1lbnQgYmVuY2hcbiAgICAgKi9cbiAgICB2YXIgRW5jaGFudG1lbnRiZW5jaCA9IE1vZEdlbmVyYXRvci5leHRlbmQoe1xuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMsIGFuZF9maWx0ZXIpIHtcbiAgICAgICAgICAgIGlmIChhbmRfZmlsdGVyID09PSBfX3VuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIC8vIGR1bW15IGZpbHRlclxuICAgICAgICAgICAgICAgIGFuZF9maWx0ZXIgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0cnVlOyB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihhbGxfbW9kcywgUm9sbGFibGVNb2QsIGZ1bmN0aW9uIChtb2QpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLlNwYXduV2VpZ2h0X1RhZ3NLZXlzICE9PSBcIlwiICYmIFxuICAgICAgICAgICAgICAgICAgICAgICAgRW5jaGFudG1lbnRiZW5jaC5tb2RfZmlsdGVyKG1vZCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqXG4gICAgICAgICAqIGV2ZXJ5IGl0ZW0gaXMgd2VsY29tZVxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdHJpbmdzOiBbXSxcbiAgICAgICAgICAgICAgICBiaXRzOiBbXVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICdFbmNoYW50bWVudGJlbmNoJztcbiAgICAgICAgfSxcbiAgICAgICAgbW9kczogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XG4gICAgICAgICAgICByZXR1cm4gJC5ncmVwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0sIHN1Y2Nlc3MpICYmIFxuICAgICAgICAgICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKGJhc2VpdGVtKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICBtYXA6IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xuICAgICAgICAgICAgcmV0dXJuICQubWFwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XG4gICAgICAgICAgICAgICAgbW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSwgc3VjY2Vzcyk7XG4gICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKGJhc2VpdGVtKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9KTtcbiAgICBcbiAgICBFbmNoYW50bWVudGJlbmNoLm1vZF9maWx0ZXIgPSBmdW5jdGlvbiAobW9kX3Byb3BzKSB7XG4gICAgICAgIC8vIHRhbGlzbWFuIHdpbGRjYXJkXG4gICAgICAgIHJldHVybiBbTW9kLk1PRF9UWVBFLkVOQ0hBTlRNRU5UXS5pbmRleE9mKCttb2RfcHJvcHMuR2VuZXJhdGlvblR5cGUpICE9PSAtMTtcbiAgICB9O1xuICAgIFxuICAgIG1vZHVsZS5leHBvcnRzID0gRW5jaGFudG1lbnRiZW5jaDtcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDdXJyZW5jeSA9IHJlcXVpcmUoJy4vQ3VycmVuY3knKTtcclxuICAgIHZhciBUcmFuc211dGUgPSByZXF1aXJlKCcuL1RyYW5zbXV0ZScpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgRXhhbHRlZCBleHRlbmRzIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBFeGFsdGVkIG9yYlxyXG4gICAgICovXHJcbiAgICB2YXIgRXhhbHRlZCA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7RXhhbHRlZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiRXhhbHRlZFwiO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWRkcyBvbmUgcmFuZG9tIHByb3BlcnR5IHRvIGFuIGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAoaXRlbSkgeyBcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIG9ubHkgYXBwbGljYWJsZSB0byByYXJlIGl0ZW1zXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW0ucmFyaXR5ICE9PSBJdGVtLlJBUklUWS5SQVJFKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBFeGFsdGVkLkFQUExJQ0FCTEVfQllURS5OT1RfUkFSRTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gQnl0ZVNldC5odW1hbih0aGlzLmFwcGxpY2FibGVfYnl0ZSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEV4YWx0ZWQuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgRXhhbHRlZC5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiRXhhbHRlZC5hcHBsaWNhYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIEV4YWx0ZWQuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfUkFSRTogNFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBFeGFsdGVkO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBNb2RHZW5lcmF0b3IgPSByZXF1aXJlKCcuL01vZEdlbmVyYXRvcicpO1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IHJlcXVpcmUoJy4vVHJhbnNtdXRlJyk7XHJcbiAgICB2YXIgVmFhbCA9IHJlcXVpcmUoJy4vVmFhbCcpO1xyXG4gICAgdmFyIFRhbGlzbWFuID0gcmVxdWlyZSgnLi9UYWxpc21hbicpO1xyXG4gICAgdmFyIEl0ZW0gPSByZXF1aXJlKCcuLi9Nb2RDb250YWluZXJzL0l0ZW0nKTtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01vZCcpO1xyXG4gICAgdmFyIEFwcGxpY2FibGVNb2QgPSByZXF1aXJlKCcuLi9tb2RzL0FwcGxpY2FibGVNb2QnKTtcclxuICAgIHZhciBSb2xsYWJsZU1vZCA9IHJlcXVpcmUoJy4uL21vZHMvUm9sbGFibGVNb2QnKTtcclxuICAgIHZhciBNYXN0ZXJNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01hc3Rlck1vZCcpO1xyXG4gICAgdmFyIFNwYXduYWJsZSA9IHJlcXVpcmUoJy4uL1NwYXduYWJsZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEl0ZW1TaG93Y2FzZSBleHRlbmRzIE1vZEdlbmVyYXRvclxyXG4gICAgICogXHJcbiAgICAgKiBNYXN0ZXJiZW5jaC9DdXJyZW5jeSBoeWJyaWRcclxuICAgICAqL1xyXG4gICAgdmFyIEl0ZW1TaG93Y2FzZSA9IE1vZEdlbmVyYXRvci5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge0l0ZW1TaG93Y2FzZX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSAkLm1hcChhbGxfbW9kcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgLy8gdHJhbnNtdXRlL3ZhYWwgbW9kc1xyXG4gICAgICAgICAgICAgICAgaWYgKCFUcmFuc211dGUubW9kX2ZpbHRlcihtb2QpICYmIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAhVmFhbC5tb2RfZmlsdGVyKG1vZCkgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgIVRhbGlzbWFuLm1vZF9maWx0ZXIobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAoK21vZC5HZW5lcmF0aW9uVHlwZSA9PT0gTW9kLk1PRF9UWVBFLlRBTElTTUFOKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBBcHBsaWNhYmxlTW9kKG1vZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICgrbW9kLkRvbWFpbiA9PT0gTW9kLkRPTUFJTi5NQVNURVIpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBtYXN0ZXJtb2Q/ID0+IGxvb2sgZm9yIGNyYWZ0aW5nYmVuY2hcclxuICAgICAgICAgICAgICAgICAgICB2YXIgY3JhZnRpbmdiZW5jaG9wdGlvbiA9ICQubWFwKE1hc3Rlck1vZC5jcmFmdGluZ2JlbmNob3B0aW9ucywgZnVuY3Rpb24gKG9wdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoK29wdGlvbi5Nb2RzS2V5ID09PSArbW9kLlJvd3MpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb247XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgfSlbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFmdGluZ2JlbmNob3B0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1vc3QgbGlrZWx5IGxlZ2FjeVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiY291bGQgbm90IGZpbmQgY3JhZnRpbmdiZW5jaG9wdGlvbiBmb3IgXCIsICttb2RbJ1Jvd3MnXSwgbW9kKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTWFzdGVyTW9kKG1vZCwgY3JhZnRpbmdiZW5jaG9wdGlvbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIHNwYXduYWJsZT9cclxuICAgICAgICAgICAgICAgIGlmIChtb2QuU3Bhd25XZWlnaHRfVGFnc0tleXMgIT09IFwiXCIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFJvbGxhYmxlTW9kKG1vZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKG1vZHMsIEFwcGxpY2FibGVNb2QpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBvbmx5IGFic3RyYWN0IHNob3djYXNlLCBub3QgZm9yIGFjdHVhbCB1c2FnZVxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7TW9kQ29udGFpbmVyfSBtb2RfY29udGFpbmVyXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWFwcyBtb2Q6OmFwcGxpY2FibGVUbyBhbmQgKGlmIGltcGxlbWVudGVkKSBtb2Q6OnNwYXduYWJsZU9uIFxyXG4gICAgICAgICAqIGlmIHdlIGhhdmUgYWxsIHRoZSBzcGFjZSBmb3IgbW9kcyB3ZSBuZWVkXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbWFwOiBmdW5jdGlvbiAoYmFzZWl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgc2hvd2Nhc2VcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBiYXNlaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlNIT1dDQVNFO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSAkLm1hcCh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgbW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmIChTcGF3bmFibGUuaW1wbGVtZW50ZWRCeShtb2QpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gdmFhbHMgcmVwbGFjZSBzbyB3ZSBkb250IGNhcmUgYWJvdXQgZnVsbCBvciBub3RcclxuICAgICAgICAgICAgICAgIGlmIChtb2QuaXNUeXBlKFwidmFhbFwiKSAmJiBtb2QuYXBwbGljYWJsZV9ieXRlICYgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUuRE9NQUlOX0ZVTEwpIHtcclxuICAgICAgICAgICAgICAgICAgICBtb2QuYXBwbGljYWJsZV9ieXRlIF49IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkRPTUFJTl9GVUxMO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ3JlcHMgbW9kOjphcHBsaWNhYmxlVG8gYW5kIChpZiBpbXBsZW1lbnRlZCkgbW9kOjpzcGF3bmFibGVPbiBcclxuICAgICAgICAgKiBpZiB3ZSBoYXZlIGFsbCB0aGUgc3BhY2UgZm9yIG1vZHMgd2UgbmVlZFxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSBzaG93Y2FzZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGJhc2VpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuU0hPV0NBU0U7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbW9kcyA9ICQubWFwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobW9kLmFwcGxpY2FibGVUbyhiYXNlaXRlbSwgc3VjY2VzcykgJiYgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICghU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSB8fCBtb2Quc3Bhd25hYmxlT24oYmFzZWl0ZW0pKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIHZhYWxzIHJlcGxhY2Ugc28gd2UgZG9udCBjYXJlIGFib3V0IGZ1bGwgb3Igbm90XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG1vZC5pc1R5cGUoXCJ2YWFsXCIpICYmIG1vZC5hcHBsaWNhYmxlX2J5dGUgJiBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5ET01BSU5fRlVMTCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBtb2QuYXBwbGljYWJsZV9ieXRlIF49IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkRPTUFJTl9GVUxMO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBuYW1lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIkl0ZW0gU2hvd2Nhc2VcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBJdGVtU2hvd2Nhc2U7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIE1vZEdlbmVyYXRvciA9IHJlcXVpcmUoJy4vTW9kR2VuZXJhdG9yJyk7XHJcbiAgICB2YXIgTWFzdGVyTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9NYXN0ZXJNb2QnKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICBcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogY2xhc3MgTWFzdGVyYmVuY2ggZXh0ZW5kcyBNb2RHZW5lcmF0b3JcclxuICAgICAqIFxyXG4gICAgICogaW5nYW1lIHJlcHJlc2VudGF0aW9uIG9mIGEgQ3JhZnRpbmdiZW5jaFxyXG4gICAgICovXHJcbiAgICB2YXIgTWFzdGVyYmVuY2ggPSBNb2RHZW5lcmF0b3IuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBNYXN0ZXJNb2QuY3JhZnRpbmdiZW5jaG9wdGlvbnMgbmVlZHMgdG8gYmUgaW5pdGlhbGl6ZWRcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBhbGxfbW9kc1xyXG4gICAgICAgICAqIEBwYXJhbSB7TnVtYmVyfSBucGNfbWFzdGVyX2tleSBOUENNYXN0ZXJLZXkgY29sdW1uXHJcbiAgICAgICAgICogQHJldHVybnMge01hc3RlcmJlbmNofVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChhbGxfbW9kcywgbnBjX21hc3Rlcl9rZXkpIHtcclxuICAgICAgICAgICAgLy8gYWxsIG9wdGlvbnNcclxuICAgICAgICAgICAgLy8gY3JhZnRpbmdiZW5jaG9wdGlvbnMgaW5zdGFuY2VvZiB7fSBzbyB3ZSBjYW50IHVzZSBncmVwXHJcbiAgICAgICAgICAgIHRoaXMuY3JhZnRpbmdiZW5jaG9wdGlvbnMgPSAkLm1hcChNYXN0ZXJNb2QuY3JhZnRpbmdiZW5jaG9wdGlvbnMsIGZ1bmN0aW9uIChvcHRpb24pIHtcclxuICAgICAgICAgICAgICAgIGlmICgrb3B0aW9uLk5QQ01hc3RlcktleSA9PT0gbnBjX21hc3Rlcl9rZXkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9uO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gaW5pdCBtb2RzXHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgICAqIHxtb2RzfCA+PiB8Y3JhZnRpbmdiZW5jaG9wdGlvbnN8IHNvIHdlIGxvb3AgdGhyb3VnaFxyXG4gICAgICAgICAgICAgKiBtb2RzIGFuZCBncmVwIG9wdGlvbnMgaW5zdGVhZCBvZiBsb29waW5nIHRocm91Z2ggb3B0aW9ucyBcclxuICAgICAgICAgICAgICogYW5kIGdyZXAgbW9kXHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKCQubWFwKGFsbF9tb2RzLCBmdW5jdGlvbiAobW9kX3Byb3BzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoK21vZF9wcm9wcy5Eb21haW4gPT09IE1vZC5ET01BSU4uTUFTVEVSKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gbWFzdGVybW9kPyA9PiBsb29rIGZvciBjcmFmdGluZ2JlbmNoXHJcbiAgICAgICAgICAgICAgICAgICAgdmFyIGNyYWZ0aW5nYmVuY2hvcHRpb24gPSAkLmdyZXAodGhhdC5jcmFmdGluZ2JlbmNob3B0aW9ucywgZnVuY3Rpb24gKG9wdGlvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gK29wdGlvbi5Nb2RzS2V5ID09PSArbW9kX3Byb3BzLlJvd3M7XHJcbiAgICAgICAgICAgICAgICAgICAgfSlbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFjcmFmdGluZ2JlbmNob3B0aW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIG1vc3QgbGlrZWx5IGxlZ2FjeVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nKFwiY291bGQgbm90IGZpbmQgY3JhZnRpbmdiZW5jaG9wdGlvbiBmb3IgXCIsICttb2RbJ1Jvd3MnXSwgbW9kKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgTWFzdGVyTW9kKG1vZF9wcm9wcywgY3JhZnRpbmdiZW5jaG9wdGlvbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICB9KSwgTWFzdGVyTW9kKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHBvc3NpYmxlIGludGVyZmFjZSBiZXR3ZWVuIGd1aSBhbmQgY2xhc3NcclxuICAgICAgICAgICAgdGhpcy5jaG9zZW5fbW9kID0gbnVsbDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFwcGxpZXMgYSBjaG9zZW4gY3JhZnRpbmdiZW5jaG9wdGlvblxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9uX2luZGV4IG9wdGlvbl9pbmRleCB3aXRoaW4gdGhpcy5jcmFmdGluZ2JlbmNob3B0aW9uc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgb3B0aW9uX2luZGV4KSB7XHJcbiAgICAgICAgICAgIHZhciBtb2QsIG9sZF9yYXJpdHk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBvcHRpb24gd2l0aGluIG9wdGlvbnNcclxuICAgICAgICAgICAgdmFyIG9wdGlvbiA9IHRoaXMuY3JhZnRpbmdiZW5jaG9wdGlvbnNbb3B0aW9uX2luZGV4XTtcclxuICAgICAgICAgICAgaWYgKG9wdGlvbiA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbW9kID0gJC5ncmVwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gK21vZC5nZXRQcm9wKFwiUm93c1wiKSA9PT0gK29wdGlvbi5Nb2RzS2V5O1xyXG4gICAgICAgICAgICB9KVswXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHZhbGlkIG1vZD9cclxuICAgICAgICAgICAgaWYgKCEobW9kIGluc3RhbmNlb2YgTWFzdGVyTW9kKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cobW9kLCBcIm5lZWRzIHRvIGJlIGluc3RhbmNlb2YgTWFzdGVyTW9kXCIpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyB3aGl0ZSBnZXRzIHVwZ3JhZGVkIHRvIGJsdWVcclxuICAgICAgICAgICAgb2xkX3Jhcml0eSA9IGJhc2VpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgaWYgKG9sZF9yYXJpdHkgPT09IEl0ZW0uUkFSSVRZLk5PUk1BTCkge1xyXG4gICAgICAgICAgICAgICAgYmFzZWl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIG1vZCBhcHBsaWNhYmxlXHJcbiAgICAgICAgICAgIGlmIChtb2QuYXBwbGljYWJsZVRvKGJhc2VpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJhc2VpdGVtLmFkZE1vZChtb2QpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZXR1cm4gdG8gb2xkIHJhcml0eSBvbiBmYWlsdXJlXHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBldmVyeSBpdGVtIGlzIHdlbGNvbWVcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgc3RyaW5nczogW10sXHJcbiAgICAgICAgICAgICAgICBiaXRzOiBbXVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogZ3JlcHMgbW9kOjphcHBsaWNhYmxlVG8gXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7QXJyYXl9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbW9kczogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIC8vIHNpbXVsYXRlIGJsdWUgaWYgd2hpdGVcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBiYXNlaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGlmIChvbGRfcmFyaXR5ID09PSBJdGVtLlJBUklUWS5OT1JNQUwpIHtcclxuICAgICAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk1BR0lDO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbW9kcyA9ICQuZ3JlcCh0aGlzLmdldEF2YWlsYWJsZU1vZHMoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG1vZC5hcHBsaWNhYmxlVG8oYmFzZWl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHJlcm9sbFxyXG4gICAgICAgICAgICBiYXNlaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBncmVwcyBtb2Q6OmFwcGxpY2FibGVUb1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gYmFzZWl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1hcDogZnVuY3Rpb24gKGJhc2VpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIC8vIHNpbXVsYXRlIGJsdWUgaWYgd2hpdGVcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBiYXNlaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGlmIChvbGRfcmFyaXR5ID09PSBJdGVtLlJBUklUWS5OT1JNQUwpIHtcclxuICAgICAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk1BR0lDO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbW9kcyA9ICQubWFwKHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpLCBmdW5jdGlvbiAobW9kKSB7XHJcbiAgICAgICAgICAgICAgICBtb2QuYXBwbGljYWJsZVRvKGJhc2VpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2Q7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVyb2xsXHJcbiAgICAgICAgICAgIGJhc2VpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuY3JhZnRpbmdiZW5jaG9wdGlvbnNbMF0uTWFzdGVyTmFtZVNob3J0O1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1hc3RlcmJlbmNoO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4uL0luaGVyaXRhbmNlJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIFxyXG4gICAgaWYgKCQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLypcclxuICAgICAqIGFic3RyYWN0IENsYXNzIE1vZEdlbmVyYXRvciBpbXBsZW1lbnRzIEFwcGxpY2FibGVcclxuICAgICAqL1xyXG4gICAgdmFyIE1vZEdlbmVyYXRvciA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheVttb2RzXX0gbW9kX2NvbGxlY3Rpb25cclxuICAgICAgICAgKiBAcGFyYW0ge1N0cmluZ30gbW9kX2tsYXNzXHJcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gZmlsdGVyIGZpbHRlciBmb3IgbW9kX3Byb3BzXHJcbiAgICAgICAgICogQHJldHVybnMge01vZEdlbmVyYXRvcn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAobW9kX2NvbGxlY3Rpb24sIG1vZF9rbGFzcywgZmlsdGVyKSB7XHJcbiAgICAgICAgICAgIHRoaXMudXNlcyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAvLyBkdW1teSBmaWx0ZXJcclxuICAgICAgICAgICAgICAgIGZpbHRlciA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRydWU7IH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIGFscmVhZHkgZmlsdGVyZWQ/XHJcbiAgICAgICAgICAgIGlmIChtb2RfY29sbGVjdGlvblswXSBpbnN0YW5jZW9mIG1vZF9rbGFzcykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVfbW9kcyA9IG1vZF9jb2xsZWN0aW9uO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hdmFpbGFibGVfbW9kcyA9ICQubWFwKG1vZF9jb2xsZWN0aW9uLCBmdW5jdGlvbiAobW9kX3Byb3BzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGZpbHRlcihtb2RfcHJvcHMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgbW9kX2tsYXNzKG1vZF9wcm9wcyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEFwcGxpY2FibGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlVOU0NBTk5FRDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGFic3RyYWN0XHJcbiAgICAgICAgICogQHBhcmFtIHtNb2RDb250YWluZXJ9IG1vZF9jb250YWluZXJcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBseVRvOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheVtNb2RdfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGdldEF2YWlsYWJsZU1vZHM6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXZhaWxhYmxlX21vZHMuc2xpY2UoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1vZHM6IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmdldEF2YWlsYWJsZU1vZHMoKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG1hcDogZnVuY3Rpb24gKG1vZF9jb250YWluZXIsIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QXZhaWxhYmxlTW9kcygpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYWJzdHJhY3RcclxuICAgICAgICAgKiBAcGFyYW0ge01vZENvbnRhaW5lcn0gbW9kX2NvbnRhaW5lclxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVzZXRBcHBsaWNhYmxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5VTlNDQU5ORUQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhYnN0cmFjdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2Fic3RyYWN0JztcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFwcGxpY2FibGVDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYXBwbGljYWJsZV9ieXRlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgY2hvb3NlTW9kOiBmdW5jdGlvbiAoYmFzZWl0ZW0pIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gdGhpcy5tb2RzKGJhc2VpdGVtKTtcclxuICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gVE9ETyBzcGF3bndlaWdodFxyXG4gICAgICAgICAgICByZXR1cm4gbW9kc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAobW9kcy5sZW5ndGggLSAxKSldO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJBYnN0cmFjdE1vZEdlbmVyYXRvclwiO1xyXG4gICAgICAgIH1cclxuICAgIH0pOyBcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNb2RHZW5lcmF0b3I7XHJcbn0pLmNhbGwodGhpcyk7XHJcblxyXG4iLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IHJlcXVpcmUoJy4vVHJhbnNtdXRlJyk7XHJcbiAgICB2YXIgQXVnbWVudCA9IHJlcXVpcmUoJy4vQXVnbWVudCcpO1xyXG4gICAgdmFyIEFsdGVyYXRpb24gPSByZXF1aXJlKCcuL0FsdGVyYXRpb24nKTtcclxuICAgIHZhciBTY291cmluZyA9IHJlcXVpcmUoJy4vU2NvdXJpbmcnKTtcclxuICAgIHZhciBSZWdhbCA9IHJlcXVpcmUoJy4vUmVnYWwnKTtcclxuICAgIHZhciBBbGNoZW15ID0gcmVxdWlyZSgnLi9BbGNoZW15Jyk7XHJcbiAgICB2YXIgQ2hhb3MgPSByZXF1aXJlKCcuL0NoYW9zJyk7XHJcbiAgICB2YXIgRXhhbHRlZCA9IHJlcXVpcmUoJy4vRXhhbHRlZCcpO1xyXG4gICAgdmFyIEl0ZW1TaG93Y2FzZSA9IHJlcXVpcmUoJy4vSXRlbVNob3djYXNlJyk7XHJcbiAgICB2YXIgRW5jaGFudG1lbnRiZW5jaCA9IHJlcXVpcmUoJy4vRW5jaGFudG1lbnRiZW5jaCcpO1xyXG4gICAgXHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yRmFjdG9yeSA9IENsYXNzLmV4dGVuZCh7fSk7XHJcbiAgICBcclxuICAgIE1vZEdlbmVyYXRvckZhY3RvcnkuYnVpbGQgPSBmdW5jdGlvbiAoaWRlbnQsIGFsbF9tb2RzKSB7XHJcbiAgICAgICAgdmFyIGdlbmVyYXRvciA9IE1vZEdlbmVyYXRvckZhY3RvcnkuR0VORVJBVE9SU1tpZGVudF07XHJcbiAgICAgICAgaWYgKCFnZW5lcmF0b3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coXCJjb3VsZCBub3QgaWRlbnRpZnkgXCIsIGlkZW50KTtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBuZXcgZ2VuZXJhdG9yLmNvbnN0cnVjdG9yKGFsbF9tb2RzKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1vZEdlbmVyYXRvckZhY3RvcnkuR0VORVJBVE9SUyA9IHtcclxuICAgICAgICBUUkFOU01VVEU6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiVHJhbnNtdXRlXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiT3JiIG9mIFRyYW5zbXV0YXRpb25cIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3VycmVuY3lcIixcclxuICAgICAgICAgICAgICAgIFwiVXBncmFkZXMgYSBub3JtYWwgaXRlbSB0byBhIG1hZ2ljIGl0ZW1cIixcclxuICAgICAgICAgICAgICAgIFwiUmlnaHQgY2xpY2sgdGhpcyBpdGVtIHRoZW4gbGVmdCBjbGljayBhIG5vcm1hbCBpdGVtIHRvIGFwcGx5XCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IFRyYW5zbXV0ZVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQVVHTUVOVDoge1xyXG4gICAgICAgICAgICBrbGFzczogXCJBdWdtZW50XCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiT3JiIG9mIEF1Z21lbnRhdGlvblwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDdXJyZW5jeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJFbmNoYW50cyBhIG1hZ2ljIGl0ZW0gd2l0aCBhIG5ldyByYW5kb20gcHJvcGVydHlcIixcclxuICAgICAgICAgICAgICAgIFwiUmlnaHQgY2xpY2sgdGhpcyBpdGVtIHRoZW4gbGVmdCBjbGljayBhIG5vcm1hbCBpdGVtIHRvIGFwcGx5XCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IEF1Z21lbnRcclxuICAgICAgICB9LFxyXG4gICAgICAgIEFMVEVSQVRJT046IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiQWx0ZXJhdGlvblwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIk9yYiBvZiBBbHRlcmF0aW9uXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkN1cnJlbmN5XCIsXHJcbiAgICAgICAgICAgICAgICBcIlJlZm9yZ2VzIGEgbWFnaWMgaXRlbSB3aXRoIG5ldyByYW5kb20gcHJvcGVydGllc1wiLFxyXG4gICAgICAgICAgICAgICAgXCJSaWdodCBjbGljayB0aGlzIGl0ZW0gdGhlbiBsZWZ0IGNsaWNrIGEgbm9ybWFsIGl0ZW0gdG8gYXBwbHlcIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogQWx0ZXJhdGlvblxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgU0NPVVJJTkc6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiU2NvdXJpbmdcIixcclxuICAgICAgICAgICAgbmFtZTogXCJPcmIgb2YgU2NvdXJpbmdcIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3VycmVuY3lcIixcclxuICAgICAgICAgICAgICAgIFwiUmVtb3ZlcyBhbGwgcHJvcGVydGllcyBmcm9tIGFuIGl0ZW1cIixcclxuICAgICAgICAgICAgICAgIFwiUmlnaHQgY2xpY2sgdGhpcyBpdGVtIHRoZW4gbGVmdCBjbGljayBhIG5vcm1hbCBpdGVtIHRvIGFwcGx5XCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IFNjb3VyaW5nXHJcbiAgICAgICAgfSxcclxuICAgICAgICBSRUdBTDoge1xyXG4gICAgICAgICAgICBrbGFzczogXCJSZWdhbFwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIlJlZ2FsIE9yYlwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJDdXJyZW5jeVwiLFxyXG4gICAgICAgICAgICAgICAgXCJVcGdyYWRlcyBhIG1hZ2ljIGl0ZW0gdG8gYSByYXJlIGl0ZW1cIixcclxuICAgICAgICAgICAgICAgIFwiUmlnaHQgY2xpY2sgdGhpcyBpdGVtIHRoZW4gbGVmdCBjbGljayBhIG1hZ2ljIGl0ZW0gdG8gYXBwbHkgaXQuIEN1cnJlbnQgcHJvcGVydGllcyBhcmUgcmV0YWluZWQgYW5kIGEgbmV3IG9uZSBpcyBhZGRlZC5cIlxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICBjb25zdHJ1Y3RvcjogUmVnYWxcclxuICAgICAgICB9LFxyXG4gICAgICAgIEFMQ0hFTVk6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiQWxjaGVteVwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIk9yYiBvZiBBbGNoZW15XCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkN1cnJlbmN5XCIsXHJcbiAgICAgICAgICAgICAgICBcIlVwZ3JhZGVzIGEgbm9ybWFsIGl0ZW0gdG8gcmFyZSBpdGVtXCIsXHJcbiAgICAgICAgICAgICAgICBcIlJpZ2h0IGNsaWNrIHRoaXMgaXRlbSB0aGVuIGxlZnQgY2xpY2sgYSBtYWdpYyBpdGVtIHRvIGFwcGx5IGl0LiBDdXJyZW50IHByb3BlcnRpZXMgYXJlIHJldGFpbmVkIGFuZCBhIG5ldyBvbmUgaXMgYWRkZWQuXCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IEFsY2hlbXlcclxuICAgICAgICB9LFxyXG4gICAgICAgIENIQU9TOiB7XHJcbiAgICAgICAgICAgIGtsYXNzOiBcIkNoYW9zXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiQ2hhb3MgT3JiXCIsXHJcbiAgICAgICAgICAgIHN0YXRzOiBbXHJcbiAgICAgICAgICAgICAgICBcIkN1cnJlbmN5XCIsXHJcbiAgICAgICAgICAgICAgICBcIlVwZ3JhZGVzIGEgbWFnaWMgaXRlbSB0byBhIHJhcmUgaXRlbVwiLFxyXG4gICAgICAgICAgICAgICAgXCJSaWdodCBjbGljayB0aGlzIGl0ZW0gdGhlbiBsZWZ0IGNsaWNrIGEgbWFnaWMgaXRlbSB0byBhcHBseSBpdC4gQ3VycmVudCBwcm9wZXJ0aWVzIGFyZSByZXRhaW5lZCBhbmQgYSBuZXcgb25lIGlzIGFkZGVkLlwiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBDaGFvc1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgRVhBTFRFRDoge1xyXG4gICAgICAgICAgICBrbGFzczogXCJFeGFsdGVkXCIsXHJcbiAgICAgICAgICAgIG5hbWU6IFwiRXhhbHRlZCBPcmJcIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3VycmVuY3lcIixcclxuICAgICAgICAgICAgICAgIFwiRW5jaGFudHMgYSByYXJlIGl0ZW0gd2l0aCBhIG5ldyByYW5kb20gcHJvcGVydHlcIixcclxuICAgICAgICAgICAgICAgIFwiUmlnaHQgY2xpY2sgdGhpcyBpdGVtIHRoZW4gbGVmdCBjbGljayBhIHJhcmUgaXRlbSB0byBhcHBseSBpdC4gUmFyZSBpdGVtcyBjYW4gaGF2ZSB1cCB0byBzaXggcmFuZG9tIHByb3BlcnRpZXMuXCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IEV4YWx0ZWRcclxuICAgICAgICB9LFxyXG4gICAgICAgIElURU1TSE9XQ0FTRToge1xyXG4gICAgICAgICAgICBrbGFzczogXCJJdGVtU2hvd2Nhc2VcIixcclxuICAgICAgICAgICAgbmFtZTogXCJTaG93Y2FzZVwiLFxyXG4gICAgICAgICAgICBzdGF0czogW1xyXG4gICAgICAgICAgICAgICAgXCJBbGwgTW9kc1wiLFxyXG4gICAgICAgICAgICAgICAgXCJzaG93cyBhbGwgcG9zc2libGUgbW9kc1wiXHJcbiAgICAgICAgICAgIF0sXHJcbiAgICAgICAgICAgIGNvbnN0cnVjdG9yOiBJdGVtU2hvd2Nhc2VcclxuICAgICAgICB9LFxyXG4gICAgICAgIEVOQ0hBTlRNRU5UQkVOQ0g6IHtcclxuICAgICAgICAgICAga2xhc3M6IFwiRW5jaGFudG1lbnRiZW5jaFwiLFxyXG4gICAgICAgICAgICBuYW1lOiBcIkVuY2hhbnRtZW50YmVuY2hcIixcclxuICAgICAgICAgICAgc3RhdHM6IFtcclxuICAgICAgICAgICAgICAgIFwiQ3JhZnRpbmdiZW5jaFwiLFxyXG4gICAgICAgICAgICAgICAgXCJjcmFmdHMgaW1wbGljaXQgZW5jaGFudG1lbnRzXCJcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgY29uc3RydWN0b3I6IEVuY2hhbnRtZW50YmVuY2hcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZEdlbmVyYXRvckZhY3Rvcnk7XHJcbn0pLmNhbGwodGhpcyk7XHJcblxyXG4iLCIvKiBqc2hpbnQgYml0d2lzZTpmYWxzZSAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIEN1cnJlbmN5ID0gcmVxdWlyZSgnLi9DdXJyZW5jeScpO1xyXG4gICAgdmFyIFRyYW5zbXV0ZSA9IHJlcXVpcmUoJy4vVHJhbnNtdXRlJyk7XHJcbiAgICB2YXIgSXRlbSA9IHJlcXVpcmUoJy4uL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICBcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBSZWdhbCBleHRyZW5kcyBAbGluayBDdXJyZW5jeVxyXG4gICAgICogXHJcbiAgICAgKiBpbmdhbWUgcmVwcmVzZW50YXRpb24gb2YgUmVnYWwgT3JiXHJcbiAgICAgKi9cclxuICAgIHZhciBSZWdhbCA9IEN1cnJlbmN5LmV4dGVuZCh7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQGNvbnN0cnVjdG9yXHJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gYWxsX21vZHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7UmVnYWx9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBUcmFuc211dGUubW9kX2ZpbHRlcik7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIlJlZ2FsXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIG9uZSByYW5kb20gcHJvcCBhbmQgdXBncmFkZXMgdG8gcmFyZVxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gdXBncmFkZSB0byByYXJlXHJcbiAgICAgICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0uYWRkTW9kKHRoaXMuY2hvb3NlTW9kKGl0ZW0pKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBtYXBzIG1vZDo6YXBwbGljYWJsZVRvIGFzIGlmIGl0IHdlcmUgYWxyZWFkeSByYXJlXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtYXA6IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIC8vIHNpbXVsYXRlIHVwZ3JhZGVcclxuICAgICAgICAgICAgdmFyIG9sZF9yYXJpdHkgPSBpdGVtLnJhcml0eTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBJdGVtLlJBUklUWS5SQVJFO1xyXG4gICAgICAgICAgICB2YXIgbW9kcyA9IHRoaXMuX3N1cGVyKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdyZXBzIG1vZDo6YXBwbGljYWJsZVRvIGFzIGlmIGl0IHdlcmUgYWxyZWFkeSByYXJlXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtb2RzOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSB1cGdyYWRlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuUkFSRTtcclxuICAgICAgICAgICAgdmFyIG1vZHMgPSB0aGlzLl9zdXBlcihpdGVtLCBzdWNjZXNzKTtcclxuICAgICAgICAgICAgaXRlbS5yYXJpdHkgPSBvbGRfcmFyaXR5O1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIG1vZHM7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBvbmx5IGFwcGxpY2FibGUgdG8gbWFnaWNzXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW0ucmFyaXR5ICE9PSBJdGVtLlJBUklUWS5NQUdJQykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gUmVnYWwuQVBQTElDQUJMRV9CWVRFLk5PVF9NQUdJQztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLmFwcGxpY2FibGVfYnl0ZSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5hcHBsaWNhYmxlX2J5dGUsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICpcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVnYWwuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgUmVnYWwuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlJlZ2FsLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgUmVnYWwuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfTUFHSUM6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gUmVnYWw7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDdXJyZW5jeSA9IHJlcXVpcmUoJy4vQ3VycmVuY3knKTtcclxuICAgIHZhciBJdGVtID0gcmVxdWlyZSgnLi4vTW9kQ29udGFpbmVycy9JdGVtJyk7XHJcbiAgICB2YXIgTWFzdGVyTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9NYXN0ZXJNb2QnKTtcclxuICAgIHZhciBBcHBsaWNhYmxlID0gcmVxdWlyZSgnLi4vQXBwbGljYWJsZScpO1xyXG4gICAgXHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIFNjb3VyaW5nIGV4dGVuZHMgQGxpbmsgQ3VycmVuY3lcclxuICAgICAqL1xyXG4gICAgdmFyIFNjb3VyaW5nID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBubyBtb2RzIG5lZWQgZm9yIFNjb3VyaW5nLiBpdCBkb2VzIHRoZSBleGFjdCBvcHBvc2l0ZSBvZiBnZW5lcmF0aW5nIG1vZHNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcmV0dXJucyB7U2NvdXJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihbXSk7XHJcbiAgICAgICAgICAgIHRoaXMua2xhc3MgPSBcIlNjb3VyaW5nXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhcHBsaWVzIE9yYiBvZiBTY291cmluZyB0byBhbiBpdGVtXHJcbiAgICAgICAgICogY29uc2lkZXJzIGxvY2tlZCBhZmZpeGVzIG1ldGFtb2RzXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgb24gc3VjY2Vzc1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGx5VG86IGZ1bmN0aW9uIChpdGVtKSB7IFxyXG4gICAgICAgICAgICB2YXIgbG9ja2VkX3ByZWZpeGVzLCBsb2NrZWRfc3VmZml4ZXM7XHJcbiAgICAgICAgICAgIHZhciByZW1haW5pbmdfcHJlZml4ZXMsIHJlbWFpbmluZ19zdWZmaXhlcztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGxpY2FibGVUbyhpdGVtKSkge1xyXG4gICAgICAgICAgICAgICAgbG9ja2VkX3ByZWZpeGVzID0gaXRlbS5pbk1vZHMoTWFzdGVyTW9kLk1FVEFNT0QuTE9DS0VEX1BSRUZJWEVTKSAhPT0gLTE7XHJcbiAgICAgICAgICAgICAgICBsb2NrZWRfc3VmZml4ZXMgPSBpdGVtLmluTW9kcyhNYXN0ZXJNb2QuTUVUQU1PRC5MT0NLRURfU1VGRklYRVMpICE9PSAtMTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgJC5lYWNoKGl0ZW0uZ2V0QWZmaXhlcygpLCBmdW5jdGlvbiAoXywgbW9kKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGlmIChtb2QuaXNQcmVmaXgoKSAmJiAhbG9ja2VkX3ByZWZpeGVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtLnJlbW92ZU1vZChtb2QpO1xyXG4gICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1vZC5pc1N1ZmZpeCgpICYmICFsb2NrZWRfc3VmZml4ZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGl0ZW0ucmVtb3ZlTW9kKG1vZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBzZXQgY29ycmVjdCByYXJpdHlcclxuICAgICAgICAgICAgICAgIHJlbWFpbmluZ19wcmVmaXhlcyA9IGl0ZW0uZ2V0UHJlZml4ZXMoKS5sZW5ndGg7XHJcbiAgICAgICAgICAgICAgICByZW1haW5pbmdfc3VmZml4ZXMgPSBpdGVtLmdldFN1ZmZpeGVzKCkubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAocmVtYWluaW5nX3ByZWZpeGVzID09PSAwICYmIHJlbWFpbmluZ19zdWZmaXhlcyA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTk9STUFMO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChyZW1haW5pbmdfcHJlZml4ZXMgPiAxIHx8IHJlbWFpbmluZ19zdWZmaXhlcyA+IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLlJBUkU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogY2hlY2tzIGlmIG5vcm1hbCBvciB1bmlxdWUgcmFyaXR5IGFuZCByZXR1cm5zIGZhbHNlXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gc3VjY2VzcyB3aGl0ZWxpc3RlZCBAbGluayBTY291cmluZy5BUFBMSUNBQkxFX0JZVEUgdGhhdCBpcyBjb25zaWRlcmVkIGEgc3VjY2Vzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIG9uIHN1Y2Nlc3NcclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBzd2l0Y2ggKGJhc2VpdGVtLnJhcml0eSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBJdGVtLlJBUklUWS5OT1JNQUw6XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gU2NvdXJpbmcuQVBQTElDQUJMRV9CWVRFLkFMUkVBRFlfV0hJVEU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIEl0ZW0uUkFSSVRZLlVOSVFVRTpcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBTY291cmluZy5BUFBMSUNBQkxFX0JZVEUuVU5JUVVFO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2NvdXJpbmcuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2NvdXJpbmcuQVBQTElDQUJMRV9CWVRFLlNVQ0NFU1MsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlNjb3VyaW5nLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBmYWlsdXJlIGJpdHNcclxuICAgICAqL1xyXG4gICAgU2NvdXJpbmcuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBBTFJFQURZX1dISVRFOiA0LFxyXG4gICAgICAgIFVOSVFVRTogOFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBTY291cmluZztcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgTW9kR2VuZXJhdG9yID0gcmVxdWlyZSgnLi9Nb2RHZW5lcmF0b3InKTtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKCcuLi9tb2RzL01vZCcpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIFRPRE9cclxuICAgICAqL1xyXG4gICAgdmFyIFRhbGlzbWFuID0gTW9kR2VuZXJhdG9yLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgVGFsaXNtYW4ubW9kX2ZpbHRlciA9IGZ1bmN0aW9uIChtb2RfcHJvcHMpIHtcclxuICAgICAgICAvLyB0YWxpc21hbiB3aWxkY2FyZFxyXG4gICAgICAgIHJldHVybiBbTW9kLk1PRF9UWVBFLkVOQ0hBTlRNRU5UXS5pbmRleE9mKCttb2RfcHJvcHMuR2VuZXJhdGlvblR5cGUpICE9PSAtMTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gVGFsaXNtYW47XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6IGZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgSXRlbSA9IHJlcXVpcmUoJy4uL01vZENvbnRhaW5lcnMvSXRlbScpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIFxyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIHZhciBCeXRlU2V0ID0gcmVxdWlyZSgnLi4vY29uY2VybnMvQnl0ZVNldCcpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIFRyYW5zbXV0ZSBleHRlbmRzIEN1cnJlbmN5XHJcbiAgICAgKiBcclxuICAgICAqIGluZ2FtZSByZXByZXNlbnRhdGlvbiBvZiBPcmIgb2YgVHJhbnNtdXRhdGlvblxyXG4gICAgICovXHJcbiAgICB2YXIgVHJhbnNtdXRlID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge1RyYW5zbXV0ZX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAoYWxsX21vZHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoYWxsX21vZHMsIFRyYW5zbXV0ZS5tb2RfZmlsdGVyKTtcclxuICAgICAgICAgICAgdGhpcy5rbGFzcyA9IFwiVHJhbnNtdXRlXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhZGRzIDEtMiBtb2RzXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbHlUbzogZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMuYXBwbGljYWJsZVRvKGl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAvLyB1cGdyYWRlIHRvIHJhcmVcclxuICAgICAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcblxyXG4gICAgICAgICAgICAgICAgaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICAgICAgaWYgKE1hdGgucmFuZG9tKCkgPD0gMC41KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaXRlbS5hZGRNb2QodGhpcy5jaG9vc2VNb2QoaXRlbSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogbWFwcyBtb2Q6OmFwcGxpY2FibGVUbyBhcyBpZiBpdCB3ZXJlIGFscmVhZHkgbWFnaWNcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge0l0ZW19IGl0ZW1cclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0FycmF5fVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG1hcDogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgLy8gc2ltdWxhdGUgdXBncmFkZVxyXG4gICAgICAgICAgICB2YXIgb2xkX3Jhcml0eSA9IGl0ZW0ucmFyaXR5O1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IEl0ZW0uUkFSSVRZLk1BR0lDO1xyXG4gICAgICAgICAgICB2YXIgbW9kcyA9IHRoaXMuX3N1cGVyKGl0ZW0sIHN1Y2Nlc3MpO1xyXG4gICAgICAgICAgICBpdGVtLnJhcml0eSA9IG9sZF9yYXJpdHk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbW9kcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGdyZXBzIG1vZDo6YXBwbGljYWJsZVRvIGFzIGlmIGl0IHdlcmUgYWxyZWFkeSBtYWdpY1xyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7dHlwZX0gc3VjY2Vzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cclxuICAgICAgICAgKi9cclxuICAgICAgICBtb2RzOiBmdW5jdGlvbiAoaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICAvLyBzaW11bGF0ZSB1cGdyYWRlXHJcbiAgICAgICAgICAgIHZhciBvbGRfcmFyaXR5ID0gaXRlbS5yYXJpdHk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gSXRlbS5SQVJJVFkuTUFHSUM7XHJcbiAgICAgICAgICAgIHZhciBtb2RzID0gdGhpcy5fc3VwZXIoaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIGl0ZW0ucmFyaXR5ID0gb2xkX3Jhcml0eTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBtb2RzO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBiYXNlaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2VzcyB3aGl0ZWxpc3RcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qm9vbGVhbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChiYXNlaXRlbSwgc3VjY2Vzcykge1xyXG4gICAgICAgICAgICB0aGlzLl9zdXBlcihiYXNlaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIC8vIHJlbW92ZSBTVUNDRVNTIGJ5dGVcclxuICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgJj0gfkFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoYmFzZWl0ZW0ucmFyaXR5ICE9PSBJdGVtLlJBUklUWS5OT1JNQUwpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IFRyYW5zbXV0ZS5BUFBMSUNBQkxFX0JZVEUuTk9UX1dISVRFO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIXRoaXMuYXBwbGljYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA9IEFwcGxpY2FibGUuU1VDQ0VTUzsgICAgICAgICBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLmFwcGxpY2FibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKlxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCeXRlU2V0Lmh1bWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBUcmFuc211dGUuQVBQTElDQUJMRV9CWVRFLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgVHJhbnNtdXRlLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJUcmFuc211dGUuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBUcmFuc211dGUuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEN1cnJlbmN5XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9UX0FOX0lURU06IDIsXHJcbiAgICAgICAgLy8gZXh0ZW5kZWRcclxuICAgICAgICBOT1RfV0hJVEU6IDRcclxuICAgIH07XHJcbiAgICBcclxuICAgIFRyYW5zbXV0ZS5tb2RfZmlsdGVyID0gZnVuY3Rpb24gKG1vZF9wcm9wcykge1xyXG4gICAgICAgIC8vIHByZWZpeC9zdWZmaXggb25seVxyXG4gICAgICAgIHJldHVybiBbTW9kLk1PRF9UWVBFLlBSRUZJWCwgTW9kLk1PRF9UWVBFLlNVRkZJWF0uaW5kZXhPZigrbW9kX3Byb3BzLkdlbmVyYXRpb25UeXBlKSAhPT0gLTE7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFRyYW5zbXV0ZTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ3VycmVuY3kgPSByZXF1aXJlKCcuL0N1cnJlbmN5Jyk7XHJcbiAgICB2YXIgTW9kID0gcmVxdWlyZSgnLi4vbW9kcy9Nb2QnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBWYWFsIGV4dGVuZHMgQ3VycmVuY3lcclxuICAgICAqIFxyXG4gICAgICogaW5nYW1lIHJlcHJlc2VudGF0aW9uIG9mIFZhYWwgT3JiIG9ubHkgcmVnYXJkaW5nIGltcGxpY2l0IGNvcnJ1cHRpb25zXHJcbiAgICAgKi9cclxuICAgIHZhciBWYWFsID0gQ3VycmVuY3kuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAY29uc3RydWN0b3JcclxuICAgICAgICAgKiBAcGFyYW0ge3R5cGV9IGFsbF9tb2RzXHJcbiAgICAgICAgICogQHJldHVybnMge1ZhYWx9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKGFsbF9tb2RzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKGFsbF9tb2RzLCBWYWFsLm1vZF9maWx0ZXIpO1xyXG4gICAgICAgICAgICB0aGlzLmtsYXNzID0gXCJWYWFsXCI7XHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIFZhYWwubW9kX2ZpbHRlciA9IGZ1bmN0aW9uIChtb2RfcHJvcHMpIHtcclxuICAgICAgICAvLyB2YWFsIGltcGxpY2l0c1xyXG4gICAgICAgIHJldHVybiBbTW9kLk1PRF9UWVBFLlZBQUxdLmluZGV4T2YoK21vZF9wcm9wcy5HZW5lcmF0aW9uVHlwZSkgIT09IC0xO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBWYWFsO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGdsb2JhbCBDbGFzcyAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgXHJcbiAgICB2YXIgUGF0aCA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHBhdGhfc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHRoaXMucGF0aCA9IHBhdGhfc3RyaW5nLnNwbGl0KFwiL1wiKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHRoaXMuaXNfYWJzb2x1dGUgPSB0aGlzLnBhdGhbMF0gPT09ICcnO1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pc0Fic29sdXRlKCkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucGF0aC5zaGlmdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgICBnZXRCYXNlbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoW3RoaXMucGF0aC5sZW5ndGggLSAxXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGdldERpcmVjdG9yaWVzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBhdGguc2xpY2UoMCwgdGhpcy5wYXRoLmxlbmd0aCAtIDEpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNBYnNvbHV0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc19hYnNvbHV0ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIG5leHRGaWxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLnBhdGhbMF0gIT09ICcnKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5wYXRoLnNoaWZ0KCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0QmFzZW5hbWUoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBQYXRoO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qIGdsb2JhbCBDbGFzcyAqL1xyXG5cclxuKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgdmFyIENsYXNzID0gcmVxdWlyZSgnLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIEludGVyZmFjZSBTZXJpYWxpemVhYmxlXHJcbiAgICAgKi9cclxuICAgIHZhciBTZXJpYWxpemVhYmxlID0gQ2xhc3MuZXh0ZW5kKHtcclxuICAgICAgICBzZXJpYWxpemU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGtsYXNzOiBcIlwiLFxyXG4gICAgICAgICAgICAgICAgYXJnczogW10sXHJcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogQ2xhc3MgLy8gYSBDbGFzcyBpbnN0YW5jZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB2YXIgc2VyaWFsaXplZF9zdHJ1Y3QgPSBuZXcgU2VyaWFsaXplYWJsZSgpLnNlcmlhbGl6ZSgpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIEBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zMzYyNDcxL2hvdy1jYW4taS1jYWxsLWEtamF2YXNjcmlwdC1jb25zdHJ1Y3Rvci11c2luZy1jYWxsLW9yLWFwcGx5XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc2VyaWFsaXplZFxyXG4gICAgICogQHJldHVybnMge01vZEZhY3RvcnlfTDEuTW9kRmFjdG9yeS5kZXNlcmlhbGl6ZS5GYWN0b3J5RnVuY3Rpb259XHJcbiAgICAgKi9cclxuICAgIFNlcmlhbGl6ZWFibGUuZGVzZXJpYWxpemUgPSBmdW5jdGlvbiAoc2VyaWFsaXplZCkge1xyXG4gICAgICAgIGlmICghU2VyaWFsaXplYWJsZS5jaGVja1N0cnVjdChzZXJpYWxpemVkKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwic3RydWN0IGRvZXNudCBtYXRjaCBpbnRlcmZhY2Ugc3RydWN0XCIsIHNlcmlhbGl6ZWQsIHNlcmlhbGl6ZWRfc3RydWN0KTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB2YXIgY29uc3RydWN0b3IgPSBzZXJpYWxpemVkLmNvbnN0cnVjdG9yO1xyXG4gICAgICAgIHZhciBhcmdzID0gW251bGxdLmNvbmNhdChzZXJpYWxpemVkLmFyZ3MpO1xyXG4gICAgICAgIHZhciBmYWN0b3J5RnVuY3Rpb24gPSBjb25zdHJ1Y3Rvci5iaW5kLmFwcGx5KGNvbnN0cnVjdG9yLCBhcmdzKTtcclxuICAgICAgICByZXR1cm4gbmV3IGZhY3RvcnlGdW5jdGlvbigpO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgU2VyaWFsaXplYWJsZS5pbXBsZW1lbnRlZEJ5ID0gZnVuY3Rpb24gKGNsYXp6KSB7XHJcbiAgICAgICAgaWYgKCEoY2xhenogaW5zdGFuY2VvZiBDbGFzcykgfHwgdHlwZW9mIGNsYXp6LnNlcmlhbGl6ZSAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBTZXJpYWxpemVhYmxlLmNoZWNrU3RydWN0KGNsYXp6LnNlcmlhbGl6ZWQoKSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBTZXJpYWxpemVhYmxlLmNoZWNrU3RydWN0ID0gZnVuY3Rpb24gKHNlcmlhbGl6ZWQpIHtcclxuICAgICAgICB2YXIgaW1wbGVtZW50ZWRfYnkgPSB0cnVlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIGNoZWNrIGlmIGVhY2ggcHJvcGVydHkgaW4gdGhlIHN0cnVjdCBoYXMgdGhlIHNhbWUgdHlwZVxyXG4gICAgICAgICQuZWFjaChzZXJpYWxpemVkX3N0cnVjdCwgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzZXJpYWxpemVkW2tleV0gIT09IHR5cGVvZiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgaW1wbGVtZW50ZWRfYnkgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTsgLy8gYnJlYWtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBpbXBsZW1lbnRlZF9ieTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gU2VyaWFsaXplYWJsZTtcclxufSkuY2FsbCh0aGlzKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuL0luaGVyaXRhbmNlJyk7XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogSW50ZXJmYWNlXHJcbiAgICAgKi9cclxuICAgIHZhciBTcGF3bmFibGUgPSBDbGFzcy5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdGhpcy5zcGF3bndlaWdodF9jYWNoZWQgPSAwO1xyXG4gICAgICAgICAgICB0aGlzLnNwYXduY2hhbmNlID0gbnVsbDtcclxuICAgICAgICAgICAgdGhpcy5zcGF3bmFibGVfYnl0ZSA9IFNwYXduYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3Bhd25hYmxlT246IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyKSB7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaHVtYW5TcGF3bmNoYW5jZTogZnVuY3Rpb24gKHByZWNpc2lvbikge1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgcmVzZXRTcGF3bmFibGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgICAgICBzcGF3bmFibGVCeXRlSHVtYW46IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSxcclxuICAgICAgICBzcGF3bmFibGVDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIFNwYXduYWJsZS5tYXAgPSBmdW5jdGlvbiAobW9kX2NvbGxlY3Rpb24sIG1vZF9jb250YWluZXIpIHtcclxuICAgICAgICByZXR1cm4gJC5tYXAobW9kX2NvbGxlY3Rpb24uc2xpY2UoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBpZiAoU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgbW9kLnNwYXduYWJsZU9uKG1vZF9jb250YWluZXIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBtb2Q7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBTcGF3bmFibGUubW9kcyA9IGZ1bmN0aW9uIChtb2RfY29sbGVjdGlvbiwgbW9kX2NvbnRhaW5lciwgc3VjY2Vzcykge1xyXG4gICAgICAgIHJldHVybiAkLmdyZXAobW9kX2NvbGxlY3Rpb24uc2xpY2UoKSwgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICByZXR1cm4gIVNwYXduYWJsZS5pbXBsZW1lbnRlZEJ5KG1vZCkgfHwgbW9kLnNwYXduYWJsZU9uKG1vZF9jb250YWluZXIsIHN1Y2Nlc3MpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gaW50ZXJmYWNlIHBhdHRlcm5cclxuICAgIFNwYXduYWJsZS5pbXBsZW1lbnRlZEJ5ID0gZnVuY3Rpb24gKGNsYXp6KSB7XHJcbiAgICAgICAgcmV0dXJuICBjbGF6ei5zcGF3bmFibGVPbiAhPT0gX191bmRlZmluZWQ7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHBhcmFtIHtBcnJheTxTcGF3bmFibGU+fSBzcGF3bmFibGVzXHJcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBpZl9jYiBvcHRpb25hbCBjYWxsYmFjayB0byBmaWx0ZXIgbW9kc1xyXG4gICAgICogQHJldHVybnMge2Zsb2F0fVxyXG4gICAgICovXHJcbiAgICBTcGF3bmFibGUuY2FsY3VsYXRlU3Bhd25jaGFuY2UgPSBmdW5jdGlvbiAoc3Bhd25hYmxlcywgaWZfY2IpIHtcclxuICAgICAgICB2YXIgc3VtX3NwYXdud2VpZ2h0ID0gMDtcclxuICAgICAgICBpZiAodHlwZW9mIGlmX2NiICE9PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGlmX2NiICA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRydWU7IH07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgICQuZWFjaChzcGF3bmFibGVzLCBmdW5jdGlvbiAoXywgbW9kKSB7XHJcbiAgICAgICAgICAgIGlmIChTcGF3bmFibGUuaW1wbGVtZW50ZWRCeShtb2QpICYmIGlmX2NiKG1vZCkpIHtcclxuICAgICAgICAgICAgICAgIHN1bV9zcGF3bndlaWdodCArPSBtb2Quc3Bhd253ZWlnaHQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gJC5tYXAoc3Bhd25hYmxlcywgZnVuY3Rpb24gKG1vZCkge1xyXG4gICAgICAgICAgICBpZiAoU3Bhd25hYmxlLmltcGxlbWVudGVkQnkobW9kKSAmJiBtb2Quc3Bhd253ZWlnaHQgIT09IG51bGwgJiYgaWZfY2IobW9kKSkge1xyXG4gICAgICAgICAgICAgICAgbW9kLnNwYXduY2hhbmNlID0gbW9kLnNwYXdud2VpZ2h0IC8gc3VtX3NwYXdud2VpZ2h0O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gbW9kO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQ29udmVudGlvblxyXG4gICAgU3Bhd25hYmxlLlVOU0NBTk5FRCA9IDA7XHJcbiAgICBTcGF3bmFibGUuU1VDQ0VTUyA9IDE7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gU3Bhd25hYmxlO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBHZ3BrRW50cnkgPSByZXF1aXJlKCcuL0dncGtFbnRyeScpO1xyXG4gICAgdmFyIFZhbHVlUmFuZ2UgPSByZXF1aXJlKCcuL1ZhbHVlUmFuZ2UnKTtcclxuICAgIHJlcXVpcmUoJy4vY29uY2VybnMvQXJyYXknKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBTdGF0IGV4dGVuZHMgR2dwa0VudHJ5XHJcbiAgICAgKi9cclxuICAgIHZhciBTdGF0ID0gR2dwa0VudHJ5LmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKHByb3BzKTtcclxuICAgICAgICAgICAgdGhpcy52YWx1ZXMgPSBuZXcgVmFsdWVSYW5nZSgwLCAwKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHQ6IGZ1bmN0aW9uIChvdGhlcl9zdGF0cywgbG9jYWxpemF0aW9uKSB7XHJcbiAgICAgICAgICAgIGlmIChsb2NhbGl6YXRpb24gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBsb2NhbGl6YXRpb24gPSBTdGF0LmxvY2FsaXphdGlvbjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFyIGlkID0gdGhpcy5nZXRQcm9wKFwiSWRcIik7XHJcbiAgICAgICAgICAgIGlmIChsb2NhbGl6YXRpb24uZGF0YVtpZF0gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIm5vIGRlc2MgZm9yIFwiLCBpZCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gaWQ7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHZhciBwYXJhbXMgPSB0aGlzLnRQYXJhbXMob3RoZXJfc3RhdHMsIGxvY2FsaXphdGlvbik7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gbG9jYWxpemF0aW9uLnQuYXBwbHkobG9jYWxpemF0aW9uLCBbaWRdLmNvbmNhdChwYXJhbXMpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRQYXJhbXM6IGZ1bmN0aW9uIChvdGhlcl9zdGF0cywgbG9jYWxpemF0aW9uKSB7XHJcbiAgICAgICAgICAgIHZhciBpZCA9IHRoaXMuZ2V0UHJvcChcIklkXCIpO1xyXG4gICAgICAgICAgICB2YXIgcGFyYW1zID0gW3RoaXMudmFsdWVzLnRvQXJyYXkoKV07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoIWxvY2FsaXphdGlvbi5kYXRhW2lkXSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG90aGVyX3BhcmFtcyA9IGxvY2FsaXphdGlvbi5kYXRhW2lkXS5wYXJhbXM7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAob3RoZXJfcGFyYW1zICE9PSBfX3VuZGVmaW5lZCAmJiBvdGhlcl9wYXJhbXMubGVuZ3RoID4gMSkge1xyXG4gICAgICAgICAgICAgICAgcGFyYW1zID0gJC5tYXAob3RoZXJfcGFyYW1zLCBmdW5jdGlvbiAocGFyYW1faWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXIgc3RhdCA9ICQuZ3JlcChvdGhlcl9zdGF0cywgZnVuY3Rpb24gKHN0YXQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHBhcmFtX2lkID09PSBzdGF0LmdldFByb3AoXCJJZFwiKTtcclxuICAgICAgICAgICAgICAgICAgICB9KVswXTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3RhdCA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVE9ETyBtYXliZSAwIHdpbGwgbWF0Y2ggc29tZXRoaW5nPyBiZXR0ZXIgb2Ygd2l0aCAraW5mP1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gW1swLCAwXV07XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gW3N0YXQudmFsdWVzLnRvQXJyYXkoKV07XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIHBhcmFtcztcclxuICAgICAgICB9LFxyXG4gICAgICAgIHZhbHVlU3RyaW5nOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIihcIiArIHRoaXMudmFsdWVzLnRvU3RyaW5nKCkgKyBcIilcIjtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgU3RhdC5sb2NhbGl6YXRpb24gPSBudWxsO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFN0YXQ7XHJcbn0pKCk7IiwiLyogZ2xvYmFsIENsYXNzLCBWYWx1ZVJhbmdlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKFwiLi9Jbmhlcml0YW5jZVwiKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBWYWx1ZVJhbmdlXHJcbiAgICAgKiBcclxuICAgICAqIGEgMi1kaW1lbnNpb25hbCBhcnJheSB3aXRoIG9wZXJhdGlvbnMgZm9yIGNlcnRhaW4gbWF0aGVtYXRpY2FsIG9wZXJhdGlvbnNcclxuICAgICAqIGNhbiBjcmVhdGUgcmVjdXJzaXZlIHN0cnVjdHVyZXMgWygyLTQpLSg2LTgpXVxyXG4gICAgICovXHJcbiAgICB2YXIgVmFsdWVSYW5nZSA9IENsYXNzLmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKG1pbiwgbWF4KSB7XHJcbiAgICAgICAgICAgIHRoaXMubWluID0gbWluO1xyXG4gICAgICAgICAgICB0aGlzLm1heCA9IG1heDtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRvQXJyYXk6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFt0aGlzLm1pbiwgdGhpcy5tYXhdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgdG9GaXhlZDogZnVuY3Rpb24gKHByZWNpc2lvbikge1xyXG4gICAgICAgICAgICAvLyB3aWxsIHR1cm4gMi4xIGludG8gMi4xMCBcclxuICAgICAgICAgICAgdmFyIG1pbiA9IHRoaXMubWluLnRvRml4ZWQocHJlY2lzaW9uKTtcclxuICAgICAgICAgICAgaWYgKCEobWluIGluc3RhbmNlb2YgVmFsdWVSYW5nZSkpIHtcclxuICAgICAgICAgICAgICAgIC8vIGJ1dCB3aXRoIGxlYWRpbmcgKyB3ZSB3aWxsIGdldCBhIG51bWJlciBhZ2FpblxyXG4gICAgICAgICAgICAgICAgbWluID0gK21pbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIG1heCA9IHRoaXMubWF4LnRvRml4ZWQocHJlY2lzaW9uKTtcclxuICAgICAgICAgICAgaWYgKCEobWF4IGluc3RhbmNlb2YgVmFsdWVSYW5nZSkpIHtcclxuICAgICAgICAgICAgICAgIC8vIGJ1dCB3aXRoIGxlYWRpbmcgKyB3ZSB3aWxsIGdldCBhIG51bWJlciBhZ2FpblxyXG4gICAgICAgICAgICAgICAgbWF4ID0gK21heDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZVJhbmdlKG1pbiwgbWF4KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHRvU3RyaW5nOiBmdW5jdGlvbiAoZGVwdGgpIHtcclxuICAgICAgICAgICAgaWYgKHRoaXMubWluLmVxdWFscyh0aGlzLm1heCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm1pbi50b1N0cmluZygpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoZGVwdGggPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBkZXB0aCA9IDA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIHNpZ25hdHVyZSBvZiBudW1iZXIudG9TdHJpbmcocmFkaXgpIHZhcmllcyBmcm9tIHRoaXMgbWV0aG9kIHNpZyBcclxuICAgICAgICAgICAgdmFyIG1pbiA9IHRoaXMubWluO1xyXG4gICAgICAgICAgICBpZiAobWluIGluc3RhbmNlb2YgVmFsdWVSYW5nZSkge1xyXG4gICAgICAgICAgICAgICAgbWluID0gbWluLnRvU3RyaW5nKGRlcHRoICsgMSk7XHJcbiAgICAgICAgICAgIH0gXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgbWF4ID0gdGhpcy5tYXg7XHJcbiAgICAgICAgICAgIGlmIChtYXggaW5zdGFuY2VvZiBWYWx1ZVJhbmdlKSB7XHJcbiAgICAgICAgICAgICAgICBtYXggPSBtYXgudG9TdHJpbmcoZGVwdGggKyAxKTtcclxuICAgICAgICAgICAgfSBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAoZGVwdGggPiAwID8gXCIoXCIgOiBcIlwiKSArIFxyXG4gICAgICAgICAgICAgICAgICAgIFttaW4sIG1heF0uam9pbihkZXB0aCAlIDIgPyBWYWx1ZVJhbmdlLnNlcEV2ZW4gOiBWYWx1ZVJhbmdlLnNlcE9kZCkgKyBcclxuICAgICAgICAgICAgICAgICAgICAoZGVwdGggPiAwID8gXCIpXCIgOiBcIlwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGNsb25lOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgVmFsdWVSYW5nZSh0aGlzLm1pbiwgdGhpcy5tYXgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYWRkOiBmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVmFsdWVSYW5nZSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkVmFsdWVSYW5nZSh2YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkU2NhbGFyKHZhbHVlKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFkZFNjYWxhcjogZnVuY3Rpb24gKGxhbWJkYSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlUmFuZ2UodGhpcy5taW4gKyBsYW1iZGEsIHRoaXMubWF4ICsgbGFtYmRhKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGFkZFZhbHVlUmFuZ2U6IGZ1bmN0aW9uICh2YWx1ZV9yYW5nZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlUmFuZ2UodmFsdWVfcmFuZ2UuYWRkKHRoaXMubWluKSwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZV9yYW5nZS5hZGQodGhpcy5tYXgpKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGVxdWFsczogZnVuY3Rpb24gKG90aGVyX3ZhbHVlX3JhbmdlKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBvdGhlcl92YWx1ZV9yYW5nZSBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UgJiYgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5taW4uZXF1YWxzKG90aGVyX3ZhbHVlX3JhbmdlLm1pbikgJiYgXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXguZXF1YWxzKG90aGVyX3ZhbHVlX3JhbmdlLm1heCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtdWx0aXBseTogZnVuY3Rpb24gKHZhbHVlKSB7XHJcbiAgICAgICAgICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIFZhbHVlUmFuZ2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLm11bHRpcGx5VmFsdWVSYW5nZSh2YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMubXVsdGlwbHlTY2FsYXIodmFsdWUpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbXVsdGlwbHlTY2FsYXI6IGZ1bmN0aW9uIChsYW1iZGEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBWYWx1ZVJhbmdlKHRoaXMubWluICogbGFtYmRhLCB0aGlzLm1heCAqIGxhbWJkYSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBtdWx0aXBseVZhbHVlUmFuZ2U6IGZ1bmN0aW9uICh2YWx1ZV9yYW5nZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFZhbHVlUmFuZ2UodmFsdWVfcmFuZ2UubXVsdGlwbHkodGhpcy5taW4pLCBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlX3JhbmdlLm11bHRpcGx5KHRoaXMubWF4KSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc1plcm86IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9BcnJheSgpLmlzWmVybygpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBWYWx1ZVJhbmdlLnNlcE9kZCA9IFwiIHRvIFwiO1xyXG4gICAgVmFsdWVSYW5nZS5zZXBFdmVuID0gXCItXCI7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gVmFsdWVSYW5nZTtcclxufSkoKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICAvKipcclxuICAgICAqIFxyXG4gICAgICogQHJldHVybnMge0Jvb2xlYW59IHRydWUgaWYgZXZlcnkgdmFsdWUgaW4gdGhpcyBhcnJheSBlcXVhbCB6ZXJvXHJcbiAgICAgKi9cclxuICAgIEFycmF5LnByb3RvdHlwZS5pc1plcm8gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIGEgPSB0aGlzLnZhbHVlT2YoKTtcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gYS5sZW5ndGg7IGkgPCBsZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGFbaV0uaXNaZXJvID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWFbaV0uaXNaZXJvKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoK2FbaV0gIT09IDApIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qXHJcbiAgICAvKipcclxuICAgICAqIEBsaW5rIHtodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzEzNDg2NDc5L2hvdy10by1nZXQtYW4tYXJyYXktb2YtdW5pcXVlLXZhbHVlcy1mcm9tLWFuLWFycmF5LWNvbnRhaW5pbmctZHVwbGljYXRlcy1pbi1qYXZhfVxyXG4gICAgICogXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXkucHJvdG90eXBlQGNhbGw7cmV2ZXJzZUBjYWxsO2ZpbHRlckBjYWxsO3JldmVyc2V9XHJcbiAgICAgKlxyXG4gICAgQXJyYXkucHJvdG90eXBlLnVuaXF1ZSA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5yZXZlcnNlKCkuZmlsdGVyKGZ1bmN0aW9uIChlLCBpLCBhcnIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGFyci5pbmRleE9mKGUsIGkrMSkgPT09IC0xO1xyXG4gICAgICAgIH0pLnJldmVyc2UoKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogalF1ZXJ5IG1hcCBlcXVpdlxyXG4gICAgICogQHBhcmFtIHt0eXBlfSBjYWxsYmFja2ZuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXkucHJvdG90eXBlQGNhbGw7bWFwQGNhbGw7ZmlsdGVyfVxyXG4gICAgICpcclxuICAgIEFycmF5LnByb3RvdHlwZS4kbWFwID0gZnVuY3Rpb24gKGNhbGxiYWNrZm4pIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5tYXAoY2FsbGJhY2tmbikuZmlsdGVyKGZ1bmN0aW9uICh2YWx1ZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdmFsdWUgIT09IG51bGw7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGludGVyc2VjdGlvbiBvZiB0d28gYXJyYXlcclxuICAgICAqIGh0dHA6Ly9qc2ZpZGRsZS5uZXQvbmVvc3dmL2FYeld3L1xyXG4gICAgICogXHJcbiAgICAgKiBAcGFyYW0ge3R5cGV9IGFcclxuICAgICAqIEBwYXJhbSB7dHlwZX0gYlxyXG4gICAgICogQHJldHVybnMge0FycmF5fEFycmF5LmludGVyc2VjdF9zYWZlLnJlc3VsdH1cclxuICAgICAqXHJcbiAgICBBcnJheS5pbnRlcnNlY3QgPSBmdW5jdGlvbiAoYSwgYilcclxuICAgIHtcclxuICAgICAgdmFyIGFpID0gYmk9IDA7XHJcbiAgICAgIHZhciByZXN1bHQgPSBbXTtcclxuXHJcbiAgICAgIHdoaWxlKCBhaSA8IGEubGVuZ3RoICYmIGJpIDwgYi5sZW5ndGggKXtcclxuICAgICAgICAgaWYgICAgICAoYVthaV0gPCBiW2JpXSApeyBhaSsrOyB9XHJcbiAgICAgICAgIGVsc2UgaWYgKGFbYWldID4gYltiaV0gKXsgYmkrKzsgfVxyXG4gICAgICAgICBlbHNlICB0aGV5J3JlIGVxdWFsICpcclxuICAgICAgICAge1xyXG4gICAgICAgICAgIHJlc3VsdC5wdXNoKGFpKTtcclxuICAgICAgICAgICBhaSsrO1xyXG4gICAgICAgICAgIGJpKys7XHJcbiAgICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEFycmF5LnByb3RvdHlwZS5pbnRlcnNlY3QgPSBmdW5jdGlvbiAob3RoZXJfYXJyKSB7XHJcbiAgICAgICAgcmV0dXJuIEFycmF5LmludGVyc2VjdCh0aGlzLnZhbHVlT2YoKSwgb3RoZXJfYXJyKTtcclxuICAgIH07Ly8qL1xyXG59KSgpOyIsIi8qIGpzaGludCBiaXR3aXNlOmZhbHNlICovXHJcblxyXG4oZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICB2YXIgQ2xhc3MgPSByZXF1aXJlKCcuLi9Jbmhlcml0YW5jZScpO1xyXG4gICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIFxyXG4gICAgLy8gdG9kbyBpZi1leGlzdHNcclxuICAgIHZhciBCeXRlU2V0ID0gQ2xhc3MuZXh0ZW5kKHt9KTtcclxuXHJcbiAgICAvLyBUT0RPIGJsYWNrbGlzdCBpbnN0ZWFkIG9mIGlnbm9yZVxyXG4gICAgQnl0ZVNldC5odW1hbiA9IGZ1bmN0aW9uKGJ5dGUsIGJ5dGVfc2V0LCBpZ25vcmUsIGxvY2FsaXphdGlvbl9wYXRoKSB7XHJcbiAgICAgICAgdmFyIHN0cmluZ3MgPSBbXTtcclxuICAgICAgICB2YXIgYml0cyA9IFtdO1xyXG5cclxuICAgICAgICAkLmVhY2goYnl0ZV9zZXQsIGZ1bmN0aW9uIChrZXksIGJpdCkge1xyXG4gICAgICAgICAgICBpZiAoYnl0ZSAmIGJpdCAmJiAhKGJ5dGUgJiBpZ25vcmUpKSB7XHJcbiAgICAgICAgICAgICAgICBiaXRzLnB1c2goYml0KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIGxvY2FsaXplZCA9IE9iamVjdC5ieVN0cmluZyhCeXRlU2V0LmxvY2FsaXphdGlvbiwgbG9jYWxpemF0aW9uX3BhdGggKyBcIi5cIiArIGJpdCk7XHJcbiAgICAgICAgICAgICAgICBzdHJpbmdzLnB1c2gobG9jYWxpemVkID8gbG9jYWxpemVkIDoga2V5KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICBzdHJpbmdzOiBzdHJpbmdzLFxyXG4gICAgICAgICAgICBiaXRzOiBiaXRzXHJcbiAgICAgICAgfTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIEJ5dGVTZXQubG9jYWxpemF0aW9uID0gbnVsbDtcclxuICAgIFxyXG4gICAgQnl0ZVNldC5pbml0TG9jYWxpemF0aW9uID0gZnVuY3Rpb24gKCRsZWdlbmRzKSB7XHJcbiAgICAgICAgQnl0ZVNldC5sb2NhbGl6YXRpb24gPSB7fTtcclxuICAgICAgICBcclxuICAgICAgICAkKFwidWwubGVnZW5kXCIsICRsZWdlbmRzKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyICRsZWdlbmQgPSAkKHRoaXMpO1xyXG4gICAgICAgICAgICB2YXIga2xhc3MgPSAkbGVnZW5kLmRhdGEoXCJrbGFzc1wiKTtcclxuICAgICAgICAgICAgdmFyIGJ5dGVfaWRlbnQgPSAkbGVnZW5kLmRhdGEoXCJieXRlLWlkZW50XCIpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKEJ5dGVTZXQubG9jYWxpemF0aW9uW2tsYXNzXSA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIEJ5dGVTZXQubG9jYWxpemF0aW9uW2tsYXNzXSA9IHt9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBCeXRlU2V0LmxvY2FsaXphdGlvbltrbGFzc11bYnl0ZV9pZGVudF0gPSB7fTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICQoXCJsaVwiLCB0aGlzKS5lYWNoKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIHZhciAkbGkgPSAkKHRoaXMpO1xyXG4gICAgICAgICAgICAgICAgQnl0ZVNldC5sb2NhbGl6YXRpb25ba2xhc3NdW2J5dGVfaWRlbnRdWyRsaS5kYXRhKGJ5dGVfaWRlbnQpXSA9ICRsaS50ZXh0KCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnNvbGUubG9nKEJ5dGVTZXQubG9jYWxpemF0aW9uKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIHR1cm4gb2YgZXZlcnl0aGluZyBibGFja2xpc3RlZCAoYnl0ZSB4b3IgKGJ5dGUgJiBibGFja2xpc3QpID0gYnl0ZSAmICFibGFja2xpc3QpXHJcbiAgICBCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCA9IGZ1bmN0aW9uIChieXRlLCBibGFja2xpc3QpIHtcclxuICAgICAgICByZXR1cm4gYnl0ZSAmIH5ibGFja2xpc3Q7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEJ5dGVTZXQ7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgTWF0aC5yYW5kID0gZnVuY3Rpb24gKG1pbiwgbWF4KSB7XHJcbiAgICAgICAgLy8gbWF0aC5yYW5kb20oKSA9IFswLDEpID0+IG1heCAtIG1pbiAgKyAxID0gWzAsMV1cclxuICAgICAgICByZXR1cm4gTWF0aC5mbG9vcigoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4gKyAxKSkgKyBtaW4pO1xyXG4gICAgfTtcclxufSkoKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICBOdW1iZXIucHJvdG90eXBlLmVxdWFscyA9IGZ1bmN0aW9uIChvdGhlcl9udW1iZXIpIHtcclxuICAgICAgICByZXR1cm4gdHlwZW9mIG90aGVyX251bWJlciA9PT0gJ251bWJlcicgJiYgXHJcbiAgICAgICAgICAgICAgICB0aGlzLnZhbHVlT2YoKSA9PT0gb3RoZXJfbnVtYmVyO1xyXG4gICAgfTtcclxufSkoKTsiLCIoZnVuY3Rpb24gKF9fdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzY0OTE0NjMvYWNjZXNzaW5nLW5lc3RlZC1qYXZhc2NyaXB0LW9iamVjdHMtd2l0aC1zdHJpbmcta2V5XHJcbiAgICBPYmplY3QuYnlTdHJpbmcgPSBmdW5jdGlvbihvLCBzKSB7XHJcbiAgICAgICAgaWYgKHMgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcyA9IHMucmVwbGFjZSgvXFxbKFxcdyspXFxdL2csICcuJDEnKTsgLy8gY29udmVydCBpbmRleGVzIHRvIHByb3BlcnRpZXNcclxuICAgICAgICBzID0gcy5yZXBsYWNlKC9eXFwuLywgJycpOyAgICAgICAgICAgLy8gc3RyaXAgYSBsZWFkaW5nIGRvdFxyXG4gICAgICAgIHZhciBhID0gcy5zcGxpdCgnLicpO1xyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBuID0gYS5sZW5ndGg7IGkgPCBuOyArK2kpIHtcclxuICAgICAgICAgICAgdmFyIGsgPSBhW2ldO1xyXG4gICAgICAgICAgICBpZiAoayBpbiBvKSB7XHJcbiAgICAgICAgICAgICAgICBvID0gb1trXTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbztcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8qKlxyXG4gICAgICogalF1ZXJ5IG1hcCBlcXVpdlxyXG4gICAgICogQHBhcmFtIHt0eXBlfSBjYWxsYmFja2ZuXHJcbiAgICAgKiBAcmV0dXJucyB7QXJyYXkucHJvdG90eXBlQGNhbGw7bWFwQGNhbGw7ZmlsdGVyfVxyXG4gICAgICpcclxuICAgIE9iamVjdC5wcm90b3R5cGUuJG1hcCA9IGZ1bmN0aW9uIChjYWxsYmFja2ZuKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMubWFwKGNhbGxiYWNrZm4pLmZpbHRlcihmdW5jdGlvbiAodmFsdWUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlICE9PSBudWxsO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgT2JqZWN0LnByb3RvdHlwZS5tYXAgPSBmdW5jdGlvbiAoY2FsbGJhY2tmbikge1xyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcy52YWx1ZU9mKCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgc2VsZi5mb3JFYWNoKGZ1bmN0aW9uICh2YWx1ZSwga2V5KSB7XHJcbiAgICAgICAgICAgIHNlbGZba2V5XSA9IGNhbGxiYWNrZm4odmFsdWUsIGtleSwgc2VsZik7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHNlbGY7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBpZiAoISQpIHtcclxuICAgICAgICBPYmplY3QucHJvdG90eXBlLmZvckVhY2ggPSBmdW5jdGlvbiAoY2FsbGJhY2tmbikge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLmhhc093blByb3BlcnR5KGtleSkpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2B2YWx1ZWA6JywgdGhpc1trZXldKTtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdga2V5YDonLCBrZXkpO1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ2B0aGlzYDonLCB0aGlzKTtcclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrZm4odGhpc1trZXldLCBrZXksIHRoaXMpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfTtcclxuICAgIH0vLyovXHJcbn0pKCk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgU3RyaW5nLnByb3RvdHlwZS51Y2ZpcnN0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnZhbHVlT2YoKS5yZXBsYWNlKC9eKFthLXpdKS8sIGZ1bmN0aW9uIChnKSB7IHJldHVybiBnLnRvVXBwZXJDYXNlKCk7IH0pOyAgICBcclxuICAgIH07XHJcbiAgICBcclxuICAgIFN0cmluZy5wcm90b3R5cGUudW5kZXJzY29yZVRvSHVtYW4gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudmFsdWVPZigpXHJcbiAgICAgICAgICAgICAgICAvLyByZXBsYWNlIHVuZGVyc2NvcmVcclxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9fKFxcdykvZywgZnVuY3Rpb24gKGcpIHsgcmV0dXJuIFwiIFwiICsgZ1sxXS50b1VwcGVyQ2FzZSgpOyB9KS51Y2ZpcnN0KCk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgIH07XHJcbn0pKCk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xuICAgIC8qKlxuICAgICAqIFxuICAgICAqIEB0eXBlIFN0cmluZ2pRdWVyeSB1dGlsaXRpZXMgc28gd2UgY2FuIHJ1biBpbiBicm93c2VyIGFuZCBvbiBzZXJ2ZXIgd2l0aG91dCBicm93c2VyaWZ5XG4gICAgICovXG4gICAgXG4gICAgdmFyIHZlcnNpb24gPSBcIjIuMi4wXCI7XG4gICAgXG4gICAgdmFyIGFyciA9IFtdO1xuICAgIFxuICAgIHZhciBzbGljZSA9IGFyci5zbGljZTtcblxuICAgIHZhciBjb25jYXQgPSBhcnIuY29uY2F0O1xuXG4gICAgdmFyIHB1c2ggPSBhcnIucHVzaDtcblxuICAgIHZhciBpbmRleE9mID0gYXJyLmluZGV4T2Y7XG5cbiAgICB2YXIgY2xhc3MydHlwZSA9IHt9O1xuXG4gICAgdmFyIHRvU3RyaW5nID0gY2xhc3MydHlwZS50b1N0cmluZztcblxuICAgIHZhciBoYXNPd24gPSBjbGFzczJ0eXBlLmhhc093blByb3BlcnR5O1xuXG4gICAgdmFyIHN1cHBvcnQgPSB7fTtcbiAgICBcbiAgICB2YXIgc29ydE9yZGVyID0gZnVuY3Rpb24oIGEsIGIgKSB7XG5cdFx0aWYgKCBhID09PSBiICkge1xuXHRcdFx0aGFzRHVwbGljYXRlID0gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIDA7XG5cdH1cbiAgICBcbiAgICBmdW5jdGlvbiBpc0FycmF5TGlrZSggb2JqICkge1xuICAgICAgICAgICAgLy8gU3VwcG9ydDogaU9TIDguMiAobm90IHJlcHJvZHVjaWJsZSBpbiBzaW11bGF0b3IpXG4gICAgICAgICAgICAvLyBgaW5gIGNoZWNrIHVzZWQgdG8gcHJldmVudCBKSVQgZXJyb3IgKGdoLTIxNDUpXG4gICAgICAgICAgICAvLyBoYXNPd24gaXNuJ3QgdXNlZCBoZXJlIGR1ZSB0byBmYWxzZSBuZWdhdGl2ZXNcbiAgICAgICAgICAgIC8vIHJlZ2FyZGluZyBOb2RlbGlzdCBsZW5ndGggaW4gSUVcbiAgICAgICAgICAgIHZhciBsZW5ndGggPSAhIW9iaiAmJiBcImxlbmd0aFwiIGluIG9iaiAmJiBvYmoubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgICB0eXBlID0galF1ZXJ5LnR5cGUoIG9iaiApO1xuXG4gICAgICAgICAgICBpZiAoIHR5cGUgPT09IFwiZnVuY3Rpb25cIiB8fCBqUXVlcnkuaXNXaW5kb3coIG9iaiApICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB0eXBlID09PSBcImFycmF5XCIgfHwgbGVuZ3RoID09PSAwIHx8XG4gICAgICAgICAgICAgICAgICAgIHR5cGVvZiBsZW5ndGggPT09IFwibnVtYmVyXCIgJiYgbGVuZ3RoID4gMCAmJiAoIGxlbmd0aCAtIDEgKSBpbiBvYmo7XG4gICAgfSAgIFxuICAgIFxuICAgIHZhciBqUXVlcnkgPSB7XG4gICAgICAgIC8vIFVuaXF1ZSBmb3IgZWFjaCBjb3B5IG9mIGpRdWVyeSBvbiB0aGUgcGFnZVxuXHRleHBhbmRvOiBcImpRdWVyeVwiICsgKCB2ZXJzaW9uICsgTWF0aC5yYW5kb20oKSApLnJlcGxhY2UoIC9cXEQvZywgXCJcIiApLFxuXG5cdC8vIEFzc3VtZSBqUXVlcnkgaXMgcmVhZHkgd2l0aG91dCB0aGUgcmVhZHkgbW9kdWxlXG5cdGlzUmVhZHk6IHRydWUsXG5cblx0ZXJyb3I6IGZ1bmN0aW9uKCBtc2cgKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCBtc2cgKTtcblx0fSxcblxuXHRub29wOiBmdW5jdGlvbigpIHt9LFxuXG5cdGlzRnVuY3Rpb246IGZ1bmN0aW9uKCBvYmogKSB7XG5cdFx0cmV0dXJuIGpRdWVyeS50eXBlKCBvYmogKSA9PT0gXCJmdW5jdGlvblwiO1xuXHR9LFxuXG5cdGlzQXJyYXk6IEFycmF5LmlzQXJyYXksXG5cblx0aXNXaW5kb3c6IGZ1bmN0aW9uKCBvYmogKSB7XG5cdFx0cmV0dXJuIG9iaiAhPSBudWxsICYmIG9iaiA9PT0gb2JqLndpbmRvdztcblx0fSxcblxuXHRpc051bWVyaWM6IGZ1bmN0aW9uKCBvYmogKSB7XG5cblx0XHQvLyBwYXJzZUZsb2F0IE5hTnMgbnVtZXJpYy1jYXN0IGZhbHNlIHBvc2l0aXZlcyAobnVsbHx0cnVlfGZhbHNlfFwiXCIpXG5cdFx0Ly8gLi4uYnV0IG1pc2ludGVycHJldHMgbGVhZGluZy1udW1iZXIgc3RyaW5ncywgcGFydGljdWxhcmx5IGhleCBsaXRlcmFscyAoXCIweC4uLlwiKVxuXHRcdC8vIHN1YnRyYWN0aW9uIGZvcmNlcyBpbmZpbml0aWVzIHRvIE5hTlxuXHRcdC8vIGFkZGluZyAxIGNvcnJlY3RzIGxvc3Mgb2YgcHJlY2lzaW9uIGZyb20gcGFyc2VGbG9hdCAoIzE1MTAwKVxuXHRcdHZhciByZWFsU3RyaW5nT2JqID0gb2JqICYmIG9iai50b1N0cmluZygpO1xuXHRcdHJldHVybiAhalF1ZXJ5LmlzQXJyYXkoIG9iaiApICYmICggcmVhbFN0cmluZ09iaiAtIHBhcnNlRmxvYXQoIHJlYWxTdHJpbmdPYmogKSArIDEgKSA+PSAwO1xuXHR9LFxuXG5cdGlzUGxhaW5PYmplY3Q6IGZ1bmN0aW9uKCBvYmogKSB7XG5cblx0XHQvLyBOb3QgcGxhaW4gb2JqZWN0czpcblx0XHQvLyAtIEFueSBvYmplY3Qgb3IgdmFsdWUgd2hvc2UgaW50ZXJuYWwgW1tDbGFzc11dIHByb3BlcnR5IGlzIG5vdCBcIltvYmplY3QgT2JqZWN0XVwiXG5cdFx0Ly8gLSBET00gbm9kZXNcblx0XHQvLyAtIHdpbmRvd1xuXHRcdGlmICggalF1ZXJ5LnR5cGUoIG9iaiApICE9PSBcIm9iamVjdFwiIHx8IG9iai5ub2RlVHlwZSB8fCBqUXVlcnkuaXNXaW5kb3coIG9iaiApICkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICggb2JqLmNvbnN0cnVjdG9yICYmXG5cdFx0XHRcdCFoYXNPd24uY2FsbCggb2JqLmNvbnN0cnVjdG9yLnByb3RvdHlwZSwgXCJpc1Byb3RvdHlwZU9mXCIgKSApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBJZiB0aGUgZnVuY3Rpb24gaGFzbid0IHJldHVybmVkIGFscmVhZHksIHdlJ3JlIGNvbmZpZGVudCB0aGF0XG5cdFx0Ly8gfG9ianwgaXMgYSBwbGFpbiBvYmplY3QsIGNyZWF0ZWQgYnkge30gb3IgY29uc3RydWN0ZWQgd2l0aCBuZXcgT2JqZWN0XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cblx0aXNFbXB0eU9iamVjdDogZnVuY3Rpb24oIG9iaiApIHtcblx0XHR2YXIgbmFtZTtcblx0XHRmb3IgKCBuYW1lIGluIG9iaiApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0sXG5cblx0dHlwZTogZnVuY3Rpb24oIG9iaiApIHtcblx0XHRpZiAoIG9iaiA9PSBudWxsICkge1xuXHRcdFx0cmV0dXJuIG9iaiArIFwiXCI7XG5cdFx0fVxuXG5cdFx0Ly8gU3VwcG9ydDogQW5kcm9pZDw0LjAsIGlPUzw2IChmdW5jdGlvbmlzaCBSZWdFeHApXG5cdFx0cmV0dXJuIHR5cGVvZiBvYmogPT09IFwib2JqZWN0XCIgfHwgdHlwZW9mIG9iaiA9PT0gXCJmdW5jdGlvblwiID9cblx0XHRcdGNsYXNzMnR5cGVbIHRvU3RyaW5nLmNhbGwoIG9iaiApIF0gfHwgXCJvYmplY3RcIiA6XG5cdFx0XHR0eXBlb2Ygb2JqO1xuXHR9LFxuXG5cdC8vIEV2YWx1YXRlcyBhIHNjcmlwdCBpbiBhIGdsb2JhbCBjb250ZXh0XG5cdGdsb2JhbEV2YWw6IGZ1bmN0aW9uKCBjb2RlICkge1xuXHRcdHZhciBzY3JpcHQsXG5cdFx0XHRpbmRpcmVjdCA9IGV2YWw7XG5cblx0XHRjb2RlID0galF1ZXJ5LnRyaW0oIGNvZGUgKTtcblxuXHRcdGlmICggY29kZSApIHtcblxuXHRcdFx0Ly8gSWYgdGhlIGNvZGUgaW5jbHVkZXMgYSB2YWxpZCwgcHJvbG9ndWUgcG9zaXRpb25cblx0XHRcdC8vIHN0cmljdCBtb2RlIHByYWdtYSwgZXhlY3V0ZSBjb2RlIGJ5IGluamVjdGluZyBhXG5cdFx0XHQvLyBzY3JpcHQgdGFnIGludG8gdGhlIGRvY3VtZW50LlxuXHRcdFx0aWYgKCBjb2RlLmluZGV4T2YoIFwidXNlIHN0cmljdFwiICkgPT09IDEgKSB7XG5cdFx0XHRcdHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoIFwic2NyaXB0XCIgKTtcblx0XHRcdFx0c2NyaXB0LnRleHQgPSBjb2RlO1xuXHRcdFx0XHRkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKCBzY3JpcHQgKS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKCBzY3JpcHQgKTtcblx0XHRcdH0gZWxzZSB7XG5cblx0XHRcdFx0Ly8gT3RoZXJ3aXNlLCBhdm9pZCB0aGUgRE9NIG5vZGUgY3JlYXRpb24sIGluc2VydGlvblxuXHRcdFx0XHQvLyBhbmQgcmVtb3ZhbCBieSB1c2luZyBhbiBpbmRpcmVjdCBnbG9iYWwgZXZhbFxuXG5cdFx0XHRcdGluZGlyZWN0KCBjb2RlICk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9LFxuXG5cdC8vIENvbnZlcnQgZGFzaGVkIHRvIGNhbWVsQ2FzZTsgdXNlZCBieSB0aGUgY3NzIGFuZCBkYXRhIG1vZHVsZXNcblx0Ly8gU3VwcG9ydDogSUU5LTExK1xuXHQvLyBNaWNyb3NvZnQgZm9yZ290IHRvIGh1bXAgdGhlaXIgdmVuZG9yIHByZWZpeCAoIzk1NzIpXG5cdGNhbWVsQ2FzZTogZnVuY3Rpb24oIHN0cmluZyApIHtcblx0XHRyZXR1cm4gc3RyaW5nLnJlcGxhY2UoIHJtc1ByZWZpeCwgXCJtcy1cIiApLnJlcGxhY2UoIHJkYXNoQWxwaGEsIGZjYW1lbENhc2UgKTtcblx0fSxcblxuXHRub2RlTmFtZTogZnVuY3Rpb24oIGVsZW0sIG5hbWUgKSB7XG5cdFx0cmV0dXJuIGVsZW0ubm9kZU5hbWUgJiYgZWxlbS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSBuYW1lLnRvTG93ZXJDYXNlKCk7XG5cdH0sXG5cblx0ZWFjaDogZnVuY3Rpb24oIG9iaiwgY2FsbGJhY2sgKSB7XG5cdFx0dmFyIGxlbmd0aCwgaSA9IDA7XG5cblx0XHRpZiAoIGlzQXJyYXlMaWtlKCBvYmogKSApIHtcblx0XHRcdGxlbmd0aCA9IG9iai5sZW5ndGg7XG5cdFx0XHRmb3IgKCA7IGkgPCBsZW5ndGg7IGkrKyApIHtcblx0XHRcdFx0aWYgKCBjYWxsYmFjay5jYWxsKCBvYmpbIGkgXSwgaSwgb2JqWyBpIF0gKSA9PT0gZmFsc2UgKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yICggaSBpbiBvYmogKSB7XG5cdFx0XHRcdGlmICggY2FsbGJhY2suY2FsbCggb2JqWyBpIF0sIGksIG9ialsgaSBdICkgPT09IGZhbHNlICkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9iajtcblx0fSxcblxuXHQvLyBTdXBwb3J0OiBBbmRyb2lkPDQuMVxuXHR0cmltOiBmdW5jdGlvbiggdGV4dCApIHtcblx0XHRyZXR1cm4gdGV4dCA9PSBudWxsID9cblx0XHRcdFwiXCIgOlxuXHRcdFx0KCB0ZXh0ICsgXCJcIiApLnJlcGxhY2UoIHJ0cmltLCBcIlwiICk7XG5cdH0sXG5cblx0Ly8gcmVzdWx0cyBpcyBmb3IgaW50ZXJuYWwgdXNhZ2Ugb25seVxuXHRtYWtlQXJyYXk6IGZ1bmN0aW9uKCBhcnIsIHJlc3VsdHMgKSB7XG5cdFx0dmFyIHJldCA9IHJlc3VsdHMgfHwgW107XG5cblx0XHRpZiAoIGFyciAhPSBudWxsICkge1xuXHRcdFx0aWYgKCBpc0FycmF5TGlrZSggT2JqZWN0KCBhcnIgKSApICkge1xuXHRcdFx0XHRqUXVlcnkubWVyZ2UoIHJldCxcblx0XHRcdFx0XHR0eXBlb2YgYXJyID09PSBcInN0cmluZ1wiID9cblx0XHRcdFx0XHRbIGFyciBdIDogYXJyXG5cdFx0XHRcdCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRwdXNoLmNhbGwoIHJldCwgYXJyICk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJldDtcblx0fSxcblxuXHRpbkFycmF5OiBmdW5jdGlvbiggZWxlbSwgYXJyLCBpICkge1xuXHRcdHJldHVybiBhcnIgPT0gbnVsbCA/IC0xIDogaW5kZXhPZi5jYWxsKCBhcnIsIGVsZW0sIGkgKTtcblx0fSxcblxuXHRtZXJnZTogZnVuY3Rpb24oIGZpcnN0LCBzZWNvbmQgKSB7XG5cdFx0dmFyIGxlbiA9ICtzZWNvbmQubGVuZ3RoLFxuXHRcdFx0aiA9IDAsXG5cdFx0XHRpID0gZmlyc3QubGVuZ3RoO1xuXG5cdFx0Zm9yICggOyBqIDwgbGVuOyBqKysgKSB7XG5cdFx0XHRmaXJzdFsgaSsrIF0gPSBzZWNvbmRbIGogXTtcblx0XHR9XG5cblx0XHRmaXJzdC5sZW5ndGggPSBpO1xuXG5cdFx0cmV0dXJuIGZpcnN0O1xuXHR9LFxuXG5cdGdyZXA6IGZ1bmN0aW9uKCBlbGVtcywgY2FsbGJhY2ssIGludmVydCApIHtcblx0XHR2YXIgY2FsbGJhY2tJbnZlcnNlLFxuXHRcdFx0bWF0Y2hlcyA9IFtdLFxuXHRcdFx0aSA9IDAsXG5cdFx0XHRsZW5ndGggPSBlbGVtcy5sZW5ndGgsXG5cdFx0XHRjYWxsYmFja0V4cGVjdCA9ICFpbnZlcnQ7XG5cblx0XHQvLyBHbyB0aHJvdWdoIHRoZSBhcnJheSwgb25seSBzYXZpbmcgdGhlIGl0ZW1zXG5cdFx0Ly8gdGhhdCBwYXNzIHRoZSB2YWxpZGF0b3IgZnVuY3Rpb25cblx0XHRmb3IgKCA7IGkgPCBsZW5ndGg7IGkrKyApIHtcblx0XHRcdGNhbGxiYWNrSW52ZXJzZSA9ICFjYWxsYmFjayggZWxlbXNbIGkgXSwgaSApO1xuXHRcdFx0aWYgKCBjYWxsYmFja0ludmVyc2UgIT09IGNhbGxiYWNrRXhwZWN0ICkge1xuXHRcdFx0XHRtYXRjaGVzLnB1c2goIGVsZW1zWyBpIF0gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbWF0Y2hlcztcblx0fSxcblxuXHQvLyBhcmcgaXMgZm9yIGludGVybmFsIHVzYWdlIG9ubHlcblx0bWFwOiBmdW5jdGlvbiggZWxlbXMsIGNhbGxiYWNrLCBhcmcgKSB7XG5cdFx0dmFyIGxlbmd0aCwgdmFsdWUsXG5cdFx0XHRpID0gMCxcblx0XHRcdHJldCA9IFtdO1xuXG5cdFx0Ly8gR28gdGhyb3VnaCB0aGUgYXJyYXksIHRyYW5zbGF0aW5nIGVhY2ggb2YgdGhlIGl0ZW1zIHRvIHRoZWlyIG5ldyB2YWx1ZXNcblx0XHRpZiAoIGlzQXJyYXlMaWtlKCBlbGVtcyApICkge1xuXHRcdFx0bGVuZ3RoID0gZWxlbXMubGVuZ3RoO1xuXHRcdFx0Zm9yICggOyBpIDwgbGVuZ3RoOyBpKysgKSB7XG5cdFx0XHRcdHZhbHVlID0gY2FsbGJhY2soIGVsZW1zWyBpIF0sIGksIGFyZyApO1xuXG5cdFx0XHRcdGlmICggdmFsdWUgIT0gbnVsbCApIHtcblx0XHRcdFx0XHRyZXQucHVzaCggdmFsdWUgKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0Ly8gR28gdGhyb3VnaCBldmVyeSBrZXkgb24gdGhlIG9iamVjdCxcblx0XHR9IGVsc2Uge1xuXHRcdFx0Zm9yICggaSBpbiBlbGVtcyApIHtcblx0XHRcdFx0dmFsdWUgPSBjYWxsYmFjayggZWxlbXNbIGkgXSwgaSwgYXJnICk7XG5cblx0XHRcdFx0aWYgKCB2YWx1ZSAhPSBudWxsICkge1xuXHRcdFx0XHRcdHJldC5wdXNoKCB2YWx1ZSApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRmxhdHRlbiBhbnkgbmVzdGVkIGFycmF5c1xuXHRcdHJldHVybiBjb25jYXQuYXBwbHkoIFtdLCByZXQgKTtcblx0fSxcblxuXHQvLyBBIGdsb2JhbCBHVUlEIGNvdW50ZXIgZm9yIG9iamVjdHNcblx0Z3VpZDogMSxcblxuXHQvLyBCaW5kIGEgZnVuY3Rpb24gdG8gYSBjb250ZXh0LCBvcHRpb25hbGx5IHBhcnRpYWxseSBhcHBseWluZyBhbnlcblx0Ly8gYXJndW1lbnRzLlxuXHRwcm94eTogZnVuY3Rpb24oIGZuLCBjb250ZXh0ICkge1xuXHRcdHZhciB0bXAsIGFyZ3MsIHByb3h5O1xuXG5cdFx0aWYgKCB0eXBlb2YgY29udGV4dCA9PT0gXCJzdHJpbmdcIiApIHtcblx0XHRcdHRtcCA9IGZuWyBjb250ZXh0IF07XG5cdFx0XHRjb250ZXh0ID0gZm47XG5cdFx0XHRmbiA9IHRtcDtcblx0XHR9XG5cblx0XHQvLyBRdWljayBjaGVjayB0byBkZXRlcm1pbmUgaWYgdGFyZ2V0IGlzIGNhbGxhYmxlLCBpbiB0aGUgc3BlY1xuXHRcdC8vIHRoaXMgdGhyb3dzIGEgVHlwZUVycm9yLCBidXQgd2Ugd2lsbCBqdXN0IHJldHVybiB1bmRlZmluZWQuXG5cdFx0aWYgKCAhalF1ZXJ5LmlzRnVuY3Rpb24oIGZuICkgKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIFNpbXVsYXRlZCBiaW5kXG5cdFx0YXJncyA9IHNsaWNlLmNhbGwoIGFyZ3VtZW50cywgMiApO1xuXHRcdHByb3h5ID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gZm4uYXBwbHkoIGNvbnRleHQgfHwgdGhpcywgYXJncy5jb25jYXQoIHNsaWNlLmNhbGwoIGFyZ3VtZW50cyApICkgKTtcblx0XHR9O1xuXG5cdFx0Ly8gU2V0IHRoZSBndWlkIG9mIHVuaXF1ZSBoYW5kbGVyIHRvIHRoZSBzYW1lIG9mIG9yaWdpbmFsIGhhbmRsZXIsIHNvIGl0IGNhbiBiZSByZW1vdmVkXG5cdFx0cHJveHkuZ3VpZCA9IGZuLmd1aWQgPSBmbi5ndWlkIHx8IGpRdWVyeS5ndWlkKys7XG5cblx0XHRyZXR1cm4gcHJveHk7XG5cdH0sXG5cblx0bm93OiBEYXRlLm5vdyxcblxuXHQvLyBqUXVlcnkuc3VwcG9ydCBpcyBub3QgdXNlZCBpbiBDb3JlIGJ1dCBvdGhlciBwcm9qZWN0cyBhdHRhY2ggdGhlaXJcblx0Ly8gcHJvcGVydGllcyB0byBpdCBzbyBpdCBuZWVkcyB0byBleGlzdC5cblx0c3VwcG9ydDogc3VwcG9ydCxcbiAgICAgICAgdW5pcXVlOiBmdW5jdGlvbiggcmVzdWx0cyApIHtcbiAgICAgICAgICAgIHZhciBlbGVtLFxuICAgICAgICAgICAgICAgICAgICBkdXBsaWNhdGVzID0gW10sXG4gICAgICAgICAgICAgICAgICAgIGogPSAwLFxuICAgICAgICAgICAgICAgICAgICBpID0gMDtcblxuICAgICAgICAgICAgLy8gVW5sZXNzIHdlICprbm93KiB3ZSBjYW4gZGV0ZWN0IGR1cGxpY2F0ZXMsIGFzc3VtZSB0aGVpciBwcmVzZW5jZVxuICAgICAgICAgICAgaGFzRHVwbGljYXRlID0gIXN1cHBvcnQuZGV0ZWN0RHVwbGljYXRlcztcbiAgICAgICAgICAgIHNvcnRJbnB1dCA9ICFzdXBwb3J0LnNvcnRTdGFibGUgJiYgcmVzdWx0cy5zbGljZSggMCApO1xuICAgICAgICAgICAgcmVzdWx0cy5zb3J0KCBzb3J0T3JkZXIgKTtcblxuICAgICAgICAgICAgaWYgKCBoYXNEdXBsaWNhdGUgKSB7XG4gICAgICAgICAgICAgICAgICAgIHdoaWxlICggKGVsZW0gPSByZXN1bHRzW2krK10pICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICggZWxlbSA9PT0gcmVzdWx0c1sgaSBdICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaiA9IGR1cGxpY2F0ZXMucHVzaCggaSApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoIGotLSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXN1bHRzLnNwbGljZSggZHVwbGljYXRlc1sgaiBdLCAxICk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gQ2xlYXIgaW5wdXQgYWZ0ZXIgc29ydGluZyB0byByZWxlYXNlIG9iamVjdHNcbiAgICAgICAgICAgIC8vIFNlZSBodHRwczovL2dpdGh1Yi5jb20vanF1ZXJ5L3NpenpsZS9wdWxsLzIyNVxuICAgICAgICAgICAgc29ydElucHV0ID0gbnVsbDtcblxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIHZhciAkO1xuICAgIGlmICh3aW5kb3cgPT09IF9fdW5kZWZpbmVkIHx8IHdpbmRvdy5qUXVlcnkgPT09IF9fdW5kZWZpbmVkKSB7XG4gICAgICAgICQgPSBqUXVlcnk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgJCA9IHdpbmRvdy5qUXVlcnk7XG4gICAgfVxuICAgIFxuICAgIG1vZHVsZS5leHBvcnRzID0gJDtcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBNb2QgPSByZXF1aXJlKCcuL01vZCcpO1xyXG4gICAgdmFyIEFwcGxpY2FibGUgPSByZXF1aXJlKCcuLi9BcHBsaWNhYmxlJyk7XHJcbiAgICB2YXIgTUVUQV9NT0RTID0gcmVxdWlyZSgnLi9tZXRhX21vZHMnKTtcclxuICAgIFxyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIEFwcGxpY2FibGUgZXh0ZW5kcyBNb2QgaW1wbGllbWVudHMgQXBwbGljYWJsZSwgU2VyaWFsaXplYWJsZVxyXG4gICAgICovXHJcbiAgICB2YXIgQXBwbGljYWJsZU1vZCA9IE1vZC5leHRlbmQoe1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wcyBmb3IgR2dwa0VudHJ5XHJcbiAgICAgICAgICogQHJldHVybnMge3VuZGVmaW5lZH1cclxuICAgICAgICAgKi9cclxuICAgICAgICBpbml0OiBmdW5jdGlvbiAocHJvcHMpIHtcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIocHJvcHMpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQXBwbGljYWJsZVxyXG4gICAgICAgICAgICB0aGlzLnJlc2V0QXBwbGljYWJsZSgpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogYXBwbGljYWJsZSBsb2dpY1xyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEBwYXJhbSB7SXRlbX0gaXRlbVxyXG4gICAgICAgICAqIEBwYXJhbSB7Ynl0ZX0gc3VjY2Vzc1xyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufSB0cnVlIGlmIGFwcGxpY2FibGVcclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlVG86IGZ1bmN0aW9uIChpdGVtLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgfD0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyByZXNldFxyXG4gICAgICAgICAgICB0aGlzLnJlc2V0QXBwbGljYWJsZSgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCFpdGVtLmluRG9tYWluT2YoK3RoaXMuZ2V0UHJvcChcIkRvbWFpblwiKSkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLldST05HX0RPTUFJTjtcclxuICAgICAgICAgICAgfSBlbHNlIGlmICghaXRlbS5oYXNSb29tRm9yKHRoaXMpKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5ET01BSU5fRlVMTDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoK3RoaXMuZ2V0UHJvcChcIkxldmVsXCIpID4gaXRlbS5pdGVtX2xldmVsKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5MT1dFUl9JTFZMO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgY29ycmVjdF9ncm91cHMgPSAkLm1hcChpdGVtLm1vZHMsIGZ1bmN0aW9uIChtb2QpIHsgXHJcbiAgICAgICAgICAgICAgICByZXR1cm4gbW9kLmdldFByb3AoXCJDb3JyZWN0R3JvdXBcIik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKGNvcnJlY3RfZ3JvdXBzLmluZGV4T2YodGhpcy5nZXRQcm9wKFwiQ29ycmVjdEdyb3VwXCIpKSAhPT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLkFMUkVBRFlfUFJFU0VOVDtcclxuICAgICAgICAgICAgfSBcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICgrdGhpcy5nZXRQcm9wKFwiTGV2ZWxcIikgPiAyOCAmJiBpdGVtLmluTW9kcyhNRVRBX01PRFMuTExEX01PRCkgIT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGxpY2FibGVfYnl0ZSB8PSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5BQk9WRV9MTERfTEVWRUw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICghdGhpcy5hcHBsaWNhYmxlX2J5dGUpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5TVUNDRVNTOyAgICAgICAgIFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHshQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUNhY2hlZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBBcHBsaWNhYmxlLlNVQ0NFU1MpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge3ZvaWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgcmVzZXRBcHBsaWNhYmxlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlID0gQXBwbGljYWJsZS5VTlNDQU5ORUQ7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcmV0dXJucyB7Qnl0ZVNldC5odW1hbn1cclxuICAgICAgICAgKi9cclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIEFwcGxpY2FibGVNb2QuQVBQTElDQUJMRV9CWVRFLCBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcIlJvbGxhYmxlTW9kLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtPYmplY3R9IGZvciBTZXJpYWxpemVhYmxlLmRlc2VyaWFsaXplXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc2VyaWFsaXplOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBrbGFzczogXCJBcHBsaWNhYmxlTW9kXCIsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbdGhpcy5wcm9wc10sXHJcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogQXBwbGljYWJsZU1vZFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQcm9wKFwiTmFtZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJvbGxhYmxlQ2FjaGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmFwcGxpY2FibGVDYWNoZWQoKTtcclxuICAgICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgQXBwbGljYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUgPSB7XHJcbiAgICAgICAgVU5TQ0FOTkVEOiAwLCAvLyBwZXIgY29udmVudGlvbiBcclxuICAgICAgICBTVUNDRVNTOiAxLCBcclxuICAgICAgICAvLyBBcHBsaWNhYmxlXHJcbiAgICAgICAgRE9NQUlOX0ZVTEw6IDIsXHJcbiAgICAgICAgQUxSRUFEWV9QUkVTRU5UOiA0LFxyXG4gICAgICAgIFdST05HX0RPTUFJTjogOCxcclxuICAgICAgICBMT1dFUl9JTFZMOiAxNixcclxuICAgICAgICBBQk9WRV9MTERfTEVWRUw6IDMyXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IEFwcGxpY2FibGVNb2Q7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBBcHBsaWNhYmxlTW9kID0gcmVxdWlyZSgnLi9BcHBsaWNhYmxlTW9kJyk7XHJcbiAgICB2YXIgQXBwbGljYWJsZSA9IHJlcXVpcmUoJy4uL0FwcGxpY2FibGUnKTtcclxuICAgIHZhciBHZ3BrRW50cnkgPSByZXF1aXJlKCcuLi9HZ3BrRW50cnknKTtcclxuICAgIFxyXG4gICAgdmFyIEJ5dGVTZXQgPSByZXF1aXJlKCcuLi9jb25jZXJucy9CeXRlU2V0Jyk7XHJcbiAgICB2YXIgJCA9IHJlcXVpcmUoJy4uL2pxdWVyeS9qcXVlcnlfbm9kZScpO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIGNsYXNzIE1hc3Rlck1vZCBleHRlbmRzIEFwcGxpY2FibGVNb2RcclxuICAgICAqIFxyXG4gICAgICogbW9kIGZyb20gYSBtYXN0ZXJiZW5jaFxyXG4gICAgICovXHJcbiAgICB2YXIgTWFzdGVyTW9kID0gQXBwbGljYWJsZU1vZC5leHRlbmQoe1xyXG4gICAgICAgIGluaXQ6IGZ1bmN0aW9uIChtb2RfcHJvcHMsIGJlbmNoX3Byb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKG1vZF9wcm9wcyk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLmJlbmNoID0gbmV3IEdncGtFbnRyeShiZW5jaF9wcm9wcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBtb2RuYW1lIHdpdGggYmFzaWMgc3RhdHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIG5hbWU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UHJvcChcIk5hbWVcIikgKyBcclxuICAgICAgICAgICAgICAgICAgICBcIihcIiArIHRoaXMuYmVuY2guZ2V0UHJvcChcIk1hc3Rlck5hbWVTaG9ydFwiKSArIFwiIExldmVsOiBcIiArIHRoaXMuYmVuY2guZ2V0UHJvcChcIk1hc3RlckxldmVsXCIpICsgXCIpXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBhcHBsaWNhYmxlIGxvZ2ljXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtJdGVtfSBpdGVtXHJcbiAgICAgICAgICogQHBhcmFtIHtieXRlfSBzdWNjZXNzIHdoaXRlbGlzdFxyXG4gICAgICAgICAqIEByZXR1cm5zIHtCb29sZWFufVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGFwcGxpY2FibGVUbzogZnVuY3Rpb24gKGl0ZW0sIHN1Y2Nlc3MpIHtcclxuICAgICAgICAgICAgdmFyIGJhc2VfaXRlbV9jbGFzc2VzO1xyXG4gICAgICAgICAgICBpZiAoc3VjY2VzcyA9PT0gX191bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3MgPSBBcHBsaWNhYmxlLlNVQ0NFU1M7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzIHw9IEFwcGxpY2FibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdGhpcy5fc3VwZXIoaXRlbSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBiYXNlX2l0ZW1fY2xhc3NlcyA9IHRoaXMuYmVuY2gudmFsdWVBc0FycmF5KFwiQmFzZUl0ZW1DbGFzc2VzS2V5c1wiKTtcclxuICAgICAgICAgICAgaWYgKGJhc2VfaXRlbV9jbGFzc2VzLmxlbmd0aCA+IDAgJiYgYmFzZV9pdGVtX2NsYXNzZXMuaW5kZXhPZigraXRlbS5lbnRyeS5nZXRQcm9wKFwiSXRlbUNsYXNzXCIpKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwbGljYWJsZV9ieXRlIHw9IE1hc3Rlck1vZC5BUFBMSUNBQkxFX0JZVEUuV1JPTkdfSVRFTUNMQVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyBncmVwIE1hc3Rlck1vZHMgYW5kIHNldCBmYWlsdXJlIGlmIHdlIGNhbnQgbXVsdGltb2RcclxuICAgICAgICAgICAgaWYgKCQuZ3JlcChpdGVtLm1vZHMsIGZ1bmN0aW9uIChtb2QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBtb2QgaW5zdGFuY2VvZiBNYXN0ZXJNb2Q7XHJcbiAgICAgICAgICAgIH0pLmxlbmd0aCA+IDAgJiYgaXRlbS5pbk1vZHMoTWFzdGVyTW9kLk1FVEFNT0QuTVVMVElNT0QpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgfD0gTWFzdGVyTW9kLkFQUExJQ0FCTEVfQllURS5OT19NVUxUSU1PRDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gcmVtb3ZlIFNVQ0NFU1MgQml0IGZyb20gc3VwZXIgaWYgYWRkaXRpb25hbCBmYWlsdXJlIGJpdHMgc2V0XHJcbiAgICAgICAgICAgIGlmICgodGhpcy5hcHBsaWNhYmxlX2J5dGUgJiBBcHBsaWNhYmxlLlNVQ0NFU1MpICYmICB0aGlzLmFwcGxpY2FibGVfYnl0ZSA+IEFwcGxpY2FibGUuU1VDQ0VTUykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBsaWNhYmxlX2J5dGUgXj0gQXBwbGljYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICByZXR1cm4gIUJ5dGVTZXQuYnl0ZUJsYWNrbGlzdGVkKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBzdWNjZXNzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHNlcmlhbGl6ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAga2xhc3M6IFwiTWFzdGVyTW9kXCIsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbdGhpcy5wcm9wcywgdGhpcy5iZW5jaC5wcm9wc10sXHJcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogTWFzdGVyTW9kXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfSxcclxuICAgICAgICBhcHBsaWNhYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5hcHBsaWNhYmxlX2J5dGUsIE1hc3Rlck1vZC5BUFBMSUNBQkxFX0JZVEUsIE1hc3Rlck1vZC5BUFBMSUNBQkxFX0JZVEUuU1VDQ0VTUywgXCJNYXN0ZXJNb2QuYXBwbGljYWJsZV9ieXRlXCIpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBNYXN0ZXJNb2QuQVBQTElDQUJMRV9CWVRFID0ge1xyXG4gICAgICAgIC8vIEFwcGxpY2FibGVNb2RcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsIC8vIHBlciBjb252ZW50aW9uIFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsIFxyXG4gICAgICAgIERPTUFJTl9GVUxMOiAyLFxyXG4gICAgICAgIEFMUkVBRFlfUFJFU0VOVDogNCxcclxuICAgICAgICBXUk9OR19ET01BSU46IDgsXHJcbiAgICAgICAgTE9XRVJfSUxWTDogMTYsXHJcbiAgICAgICAgQUJPVkVfTExEX0xFVkVMOiAzMixcclxuICAgICAgICAvLyBNYXN0ZXJNb2RcclxuICAgICAgICBXUk9OR19JVEVNQ0xBU1M6IDY0LFxyXG4gICAgICAgIE5PX01VTFRJTU9EOiAxMjhcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1hc3Rlck1vZC5NRVRBTU9EID0gcmVxdWlyZSgnLi9tZXRhX21vZHMnKTtcclxuICAgIFxyXG4gICAgLy8gdGFibGUgYGNyYWZ0aW5nYmVuY2hvcHRpb25zYFxyXG4gICAgTWFzdGVyTW9kLmNyYWZ0aW5nYmVuY2hvcHRpb25zID0gbnVsbDtcclxuICAgIFxyXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBNYXN0ZXJNb2Q7XHJcbn0pLmNhbGwodGhpcyk7IiwiKGZ1bmN0aW9uIChfX3VuZGVmaW5lZCkge1xyXG4gICAgcmVxdWlyZSgnLi4vY29uY2VybnMvQXJyYXknKTtcclxuICAgIFxyXG4gICAgdmFyIEdncGtFbnRyeSA9IHJlcXVpcmUoJy4uL0dncGtFbnRyeScpO1xyXG4gICAgdmFyIFN0YXQgPSByZXF1aXJlKCcuLi9TdGF0Jyk7XHJcbiAgICB2YXIgVmFsdWVSYW5nZSA9IHJlcXVpcmUoJy4uL1ZhbHVlUmFuZ2UnKTtcclxuICAgIFxyXG4gICAgaWYgKCQgPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdmFyICQgPSByZXF1aXJlKCcuLi9qcXVlcnkvanF1ZXJ5X25vZGUnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBleHRlbmRzIEdncGtFbnRyeSBpbXBsZW1lbnRzIExvY2FsaXplYWJsZVxyXG4gICAgICovXHJcbiAgICB2YXIgTW9kID0gR2dwa0VudHJ5LmV4dGVuZCh7XHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKHByb3BzKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzUHJlZml4OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzVHlwZShcInByZWZpeFwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzU3VmZml4OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmlzVHlwZShcInN1ZmZpeFwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzUHJlbWFkZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc1R5cGUoXCJwcmVtYWRlXCIpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNUeXBlOiBmdW5jdGlvbiAodHlwZSkge1xyXG4gICAgICAgICAgICByZXR1cm4gK3RoaXMuZ2V0UHJvcChcIkdlbmVyYXRpb25UeXBlXCIpID09PSBNb2QuTU9EX1RZUEVbdHlwZS50b1VwcGVyQ2FzZSgpXTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzQWZmaXg6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuaXNQcmVmaXgoKSB8fCB0aGlzLmlzU3VmZml4KCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpbXBsaWNpdENhbmRpZGF0ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pc1ByZW1hZGUoKSBcclxuICAgICAgICAgICAgICAgICAgICB8fCB0aGlzLmlzVHlwZShcInZhYWxcIikgXHJcbiAgICAgICAgICAgICAgICAgICAgfHwgdGhpcy5pc1R5cGUoXCJlbmNoYW50bWVudFwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheTxTdGF0Pn0gYWxsIHN0YXRzIGZyb20gdGhpcyBtb2RcclxuICAgICAgICAgKi9cclxuICAgICAgICBzdGF0c0pvaW5lZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIHJldHVybiAkLm1hcCh0aGlzLnZhbHVlQXNBcnJheShcIlN0YXRzXCIpLCBmdW5jdGlvbiAocm93LCBpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocm93LnRvU3RyaW5nKCkudG9Mb3dlckNhc2UoKSA9PT0gJ251bGwnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gY29udGludWVcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgdmFyIHN0YXQgPSBuZXcgU3RhdChNb2QuYWxsX3N0YXRzW3Jvd10pO1xyXG4gICAgICAgICAgICAgICAgc3RhdC52YWx1ZXMgPSBuZXcgVmFsdWVSYW5nZSgrdGhhdC5nZXRQcm9wKFwiU3RhdFwiICsgKGkgKyAxKSArIFwiTWluXCIpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICArdGhhdC5nZXRQcm9wKFwiU3RhdFwiICsgKGkgKyAxKSArIFwiTWF4XCIpKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHN0YXQ7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogdHJhbnNsYXRlcyB0aGUgc3RhdHNcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0c0pvaW5lZCgpO1xyXG4gICAgICAgICAgICAvLyBUT0RPIG1heWJlIGNoZWNrIGJlZm9yZSBsb2NhbGl6aW5nIGNhdXNlIHVuaXF1ZSBvbiBsb25nIHN0cmluZ3MgbWlnaHRcclxuICAgICAgICAgICAgLy8gYmUgaW5lZmZpY2llbnQuIG9uIHRoZSBvdGhlciBoYW5kIHdlIGFsbW9zdCBhbHdheXMgaGFuZGxlIDwgMTAgbW9kc1xyXG4gICAgICAgICAgICByZXR1cm4gJC51bmlxdWUoJC5tYXAoc3RhdHMsIGZ1bmN0aW9uIChzdGF0KSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoc3RhdC52YWx1ZXMuaXNaZXJvKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBzdGF0LnQoc3RhdHMsIE1vZC5sb2NhbGl6YXRpb24pO1xyXG4gICAgICAgICAgICB9KSkuam9pbihcIlxcblwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHRyYW5zbGF0ZXMgdGhlIGNvcnJlY3QgZ3JvdXBcclxuICAgICAgICAgKiBAcmV0dXJucyB7U3RyaW5nfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNvcnJlY3RHcm91cFRyYW5zbGF0ZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgdmFyIGNvcnJlY3RfZ3JvdXAgPSB0aGlzLmdldFByb3AoXCJDb3JyZWN0R3JvdXBcIik7XHJcbiAgICAgICAgICAgIHZhciB0cmFuc2xhdGVkID0gTW9kLmNvcnJlY3RfZ3JvdXBfbG9jYWxpemF0aW9uW2NvcnJlY3RfZ3JvdXBdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRyYW5zbGF0ZWQgPT09IF9fdW5kZWZpbmVkIHx8IHRyYW5zbGF0ZWQgPT09IFwiXCIpIHtcclxuICAgICAgICAgICAgICAgIC8vIERlQ2FtZWxpemVcclxuICAgICAgICAgICAgICAgIHJldHVybiBjb3JyZWN0X2dyb3VwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGluc2VydCBhIHNwYWNlIGJlZm9yZSBhbGwgY2Fwc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKFtBLVpdKS9nLCAnICQxJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB0cmFuc2xhdGVkO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogc3RyaW5nIGlkZW50aWZpZXIgb2YgdGhlIGdlbmVyYXRpb24gdHlwZVxyXG4gICAgICAgICAqIEByZXR1cm5zIHtTdHJpbmd9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgbW9kVHlwZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB2YXIgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgICAgIHJldHVybiAkLm1hcChNb2QuTU9EX1RZUEUsIGZ1bmN0aW9uIChtb2RfdHlwZSwgdHlwZV9uYW1lKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobW9kX3R5cGUgPT09ICt0aGF0LmdldFByb3AoXCJHZW5lcmF0aW9uVHlwZVwiKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0eXBlX25hbWUudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbmFtZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQcm9wKFwiTmFtZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIHVuaXF1ZSBpZCBmb3IgZG9tXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBkb21JZDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gTW9kLmRvbUlkKHRoaXMuZ2V0UHJvcChcIlJvd3NcIikpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBNb2QuZG9tSWQgPSBmdW5jdGlvbiAoaWQpIHtcclxuICAgICAgICByZXR1cm4gXCJtb2RfXCIgKyBpZDtcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1vZC5NT0RfVFlQRSA9IHtcclxuICAgICAgICBQUkVGSVg6IDEsXHJcbiAgICAgICAgU1VGRklYOiAyLFxyXG4gICAgICAgIFBSRU1BREU6IDMsXHJcbiAgICAgICAgTkVNRVNJUzogNCxcclxuICAgICAgICBWQUFMOiA1LFxyXG4gICAgICAgIEJMT09ETElORVM6IDYsXHJcbiAgICAgICAgVE9STUVOVDogNyxcclxuICAgICAgICBURU1QRVNUOiA4LFxyXG4gICAgICAgIFRBTElTTUFOOiA5LFxyXG4gICAgICAgIEVOQ0hBTlRNRU5UOiAxMFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgTW9kLkRPTUFJTiA9IHtcclxuICAgICAgICBJVEVNOiAxLFxyXG4gICAgICAgIEZMQVNLOiAyLFxyXG4gICAgICAgIE1PTlNURVI6IDMsXHJcbiAgICAgICAgU1RST05HQk9YOiA0LFxyXG4gICAgICAgIE1BUDogNSxcclxuICAgICAgICBTVEFOQ0U6IDksXHJcbiAgICAgICAgTUFTVEVSOiAxMCxcclxuICAgICAgICBKRVdFTDogMTFcclxuICAgIH07XHJcbiAgICBcclxuICAgIE1vZC5sb2NhbGl6YXRpb24gPSBudWxsO1xyXG4gICAgTW9kLmNvcnJlY3RfZ3JvdXBfbG9jYWxpemF0aW9uID0gbnVsbDtcclxuICAgIE1vZC5hbGxfc3RhdHMgPSBudWxsO1xyXG4gICAgXHJcbiAgICAvLyB0YWJsZSBgbW9kc2BcclxuICAgIHRoaXMubW9kcyA9IG51bGw7XHJcbiAgICBcclxuICAgIG1vZHVsZS5leHBvcnRzID0gTW9kO1xyXG59KS5jYWxsKHRoaXMpOyIsIihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBDbGFzcyA9IHJlcXVpcmUoJy4uL0luaGVyaXRhbmNlJyk7XHJcbiAgICB2YXIgU2VyaWFsaXplYWJsZSA9IHJlcXVpcmUoJy4uL1NlcmlhbGl6ZWFibGUnKTtcclxuICAgIFxyXG4gICAgdmFyIE1vZEZhY3RvcnkgPSBDbGFzcy5leHRlbmQoe30pO1xyXG4gICAgXHJcbiAgICAvKipcclxuICAgICAqIEBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8zMzYyNDcxL2hvdy1jYW4taS1jYWxsLWEtamF2YXNjcmlwdC1jb25zdHJ1Y3Rvci11c2luZy1jYWxsLW9yLWFwcGx5XHJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gc2VyaWFsaXplZFxyXG4gICAgICogQHJldHVybnMge01vZEZhY3RvcnlfTDEuTW9kRmFjdG9yeS5kZXNlcmlhbGl6ZS5GYWN0b3J5RnVuY3Rpb259XHJcbiAgICAgKi9cclxuICAgIE1vZEZhY3RvcnkuZGVzZXJpYWxpemUgPSBTZXJpYWxpemVhYmxlLmRlc2VyaWFsaXplO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IE1vZEZhY3Rvcnk7XHJcbn0pLmNhbGwodGhpcyk7IiwiLyoganNoaW50IGJpdHdpc2U6ZmFsc2UgKi9cclxuXHJcbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcclxuICAgIHZhciBBcHBsaWNhYmxlTW9kID0gcmVxdWlyZSgnLi9BcHBsaWNhYmxlTW9kJyk7XHJcbiAgICB2YXIgU3Bhd25hYmxlID0gcmVxdWlyZSgnLi4vU3Bhd25hYmxlJyk7XHJcbiAgICBcclxuICAgIHZhciAkID0gcmVxdWlyZSgnLi4vanF1ZXJ5L2pxdWVyeV9ub2RlJyk7XHJcbiAgICB2YXIgQnl0ZVNldCA9IHJlcXVpcmUoJy4uL2NvbmNlcm5zL0J5dGVTZXQnKTtcclxuICAgIFxyXG4gICAgLyoqXHJcbiAgICAgKiBjbGFzcyBSb2xsYWJsZU1vZCBleHRlbmRzIEFwcGxpY2FibGVNb2QgaW1wbGllbWVudHMgU3Bhd25hYmxlXHJcbiAgICAgKi9cclxuICAgIHZhciBSb2xsYWJsZU1vZCA9IEFwcGxpY2FibGVNb2QuZXh0ZW5kKHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBcclxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gcHJvcHMgZm9yIEdncGtFbnRyeVxyXG4gICAgICAgICAqIEByZXR1cm5zIHt1bmRlZmluZWR9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgaW5pdDogZnVuY3Rpb24gKHByb3BzKSB7XHJcbiAgICAgICAgICAgIHRoaXMuX3N1cGVyKHByb3BzKTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIFNwYXduYWJsZVxyXG4gICAgICAgICAgICB0aGlzLnJlc2V0U3Bhd25hYmxlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB0aGlzLnJvbGxhYmxlID0gUm9sbGFibGVNb2QuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge0J5dGVTZXQuaHVtYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgYXBwbGljYWJsZUJ5dGVIdW1hbjogZnVuY3Rpb24oKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBCeXRlU2V0Lmh1bWFuKHRoaXMuYXBwbGljYWJsZV9ieXRlLCBSb2xsYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUsIFJvbGxhYmxlTW9kLkFQUExJQ0FCTEVfQllURS5TVUNDRVNTLCBcIlJvbGxhYmxlTW9kLmFwcGxpY2FibGVfYnl0ZVwiKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIGNoZWNrcyBpZiBzcGF3bmFibGUgYW5kIHNldHMgdGhlIHNwYXdud2VpZ2h0XHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHBhcmFtIHtNb2RDb250YWluZXJ9IG1vZF9jb250YWluZXJcclxuICAgICAgICAgKiBAcGFyYW0ge2J5dGV9IHN1Y2Nlc3Mgd2hpdGVsaXN0XHJcbiAgICAgICAgICogQHJldHVybnMge0Jvb2xlYW59XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgc3Bhd25hYmxlT246IGZ1bmN0aW9uIChtb2RfY29udGFpbmVyLCBzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgIGlmIChzdWNjZXNzID09PSBfX3VuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyA9IFNwYXduYWJsZS5TVUNDRVNTO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgc3VjY2VzcyB8PSBTcGF3bmFibGUuU1VDQ0VTUztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgdmFyIHNwYXdud2VpZ2h0X3RhZ3MgPSAkKHRoaXMudmFsdWVBc0FycmF5KFwiU3Bhd25XZWlnaHRfVGFnc0tleXNcIikpLmZpbHRlcihtb2RfY29udGFpbmVyLmdldFRhZ3MoKSkudG9BcnJheSgpO1xyXG4gICAgICAgICAgICAvLyByZXNldFxyXG4gICAgICAgICAgICB0aGlzLnJlc2V0U3Bhd25hYmxlKCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAoc3Bhd253ZWlnaHRfdGFncy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3Bhd25hYmxlX2J5dGUgPSBSb2xsYWJsZU1vZC5TUEFXTkFCTEVfQllURS5OT19NQVRDSElOR19UQUdTO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBmaXJzdCBzcGF3bndlaWdodF90YWcgdG8gIG1hdGNoIGFueSBpdGVtX3RhZyBnZXRzIHRvIGNob29zZVxyXG4gICAgICAgICAgICAvLyB0aGUgc3Bhd253ZWlnaHRcclxuICAgICAgICAgICAgdGhpcy5zcGF3bndlaWdodCA9IHRoaXMudmFsdWVBc0FycmF5KFwiU3Bhd25XZWlnaHRfVmFsdWVzXCIpW3RoaXMudmFsdWVBc0FycmF5KFwiU3Bhd25XZWlnaHRfVGFnc0tleXNcIikuaW5kZXhPZihzcGF3bndlaWdodF90YWdzWzBdKV07XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBpZiAodGhpcy5zcGF3bndlaWdodCA8PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNwYXdud2VpZ2h0ID0gMDtcclxuICAgICAgICAgICAgICAgIHRoaXMuc3Bhd25hYmxlX2J5dGUgfD0gUm9sbGFibGVNb2QuU1BBV05BQkxFX0JZVEUuU1BBV05XRUlHSFRfWkVSTztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKCF0aGlzLnNwYXduYWJsZV9ieXRlKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNwYXduYWJsZV9ieXRlID0gU3Bhd25hYmxlLlNVQ0NFU1M7ICAgICAgICAgXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiAhQnl0ZVNldC5ieXRlQmxhY2tsaXN0ZWQodGhpcy5zcGF3bmFibGVfYnl0ZSwgc3VjY2Vzcyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBzcGF3bmNoYW5jZSBpbiBbJV1cclxuICAgICAgICAgKiBAcGFyYW0ge051bWJlcn0gcHJlY2lzaW9uXHJcbiAgICAgICAgICogQHJldHVybnMge1N0cmluZ31cclxuICAgICAgICAgKi9cclxuICAgICAgICBodW1hblNwYXduY2hhbmNlOiBmdW5jdGlvbiAocHJlY2lzaW9uKSB7XHJcbiAgICAgICAgICAgIGlmIChwcmVjaXNpb24gPT09IF9fdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICBwcmVjaXNpb24gPSAyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICB2YXIgc3Bhd25jaGFuY2UgPSAwLjA7XHJcblxyXG4gICAgICAgICAgICAvLyBzcGF3bmNoYW5jZSBpcyBiYXNpY2FsbHkgemVybyBpZiBpdHMgbm90IGFwcGxpY2FibGVcclxuICAgICAgICAgICAgaWYgKHRoaXMuc3Bhd25jaGFuY2UgIT09IG51bGwgJiYgdGhpcy5hcHBsaWNhYmxlQ2FjaGVkKCkpIHtcclxuICAgICAgICAgICAgICAgIHNwYXduY2hhbmNlID0gdGhpcy5zcGF3bmNoYW5jZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIChzcGF3bmNoYW5jZSAqIDEwMCkudG9GaXhlZChwcmVjaXNpb24pICsgXCIlXCI7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByZXNldFNwYXduYWJsZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICB0aGlzLnNwYXdud2VpZ2h0ID0gMDtcclxuICAgICAgICAgICAgdGhpcy5zcGF3bmNoYW5jZSA9IG51bGw7XHJcbiAgICAgICAgICAgIHRoaXMuc3Bhd25hYmxlX2J5dGUgPSBTcGF3bmFibGUuVU5TQ0FOTkVEO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgc3Bhd25hYmxlQnl0ZUh1bWFuOiBmdW5jdGlvbigpIHtcclxuICAgICAgICAgICAgcmV0dXJuIEJ5dGVTZXQuaHVtYW4odGhpcy5zcGF3bmFibGVfYnl0ZSwgUm9sbGFibGVNb2QuU1BBV05BQkxFX0JZVEUsIFJvbGxhYmxlTW9kLlNQQVdOQUJMRV9CWVRFLlNVQ0NFU1MsIFwiUm9sbGFibGVNb2Quc3Bhd25hYmxlX2J5dGVcIik7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBzcGF3bmFibGVDYWNoZWQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuICFCeXRlU2V0LmJ5dGVCbGFja2xpc3RlZCh0aGlzLnNwYXduYWJsZV9ieXRlLCBTcGF3bmFibGUuU1VDQ0VTUyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICByb2xsYWJsZU9uOiBmdW5jdGlvbiAobW9kX2NvbnRhaW5lcikge1xyXG4gICAgICAgICAgICB0aGlzLnJvbGxhYmxlID0gdGhpcy5hcHBsaWNhYmxlVG8obW9kX2NvbnRhaW5lcikgJiYgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNwYXduYWJsZU9uKG1vZF9jb250YWluZXIpIDtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJvbGxhYmxlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogXHJcbiAgICAgICAgICogQHJldHVybnMge09iamVjdH0gZm9yIFNlcmlhbGl6ZWFibGUuZGVzZXJpYWxpemVcclxuICAgICAgICAgKi9cclxuICAgICAgICBzZXJpYWxpemU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIGtsYXNzOiBcIlJvbGxhYmxlTW9kXCIsXHJcbiAgICAgICAgICAgICAgICBhcmdzOiBbdGhpcy5wcm9wc10sXHJcbiAgICAgICAgICAgICAgICBjb25zdHJ1Y3RvcjogUm9sbGFibGVNb2RcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJvbGxhYmxlQ2FjaGVkOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNwYXduYWJsZUNhY2hlZCgpICYmIHRoaXMuYXBwbGljYWJsZUNhY2hlZCgpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBSb2xsYWJsZU1vZC5TUEFXTkFCTEVfQllURSA9IHtcclxuICAgICAgICBVTlNDQU5ORUQ6IDAsIC8vIHBlciBjb252ZW50aW9uIFxyXG4gICAgICAgIFNVQ0NFU1M6IDEsXHJcbiAgICAgICAgTk9fTUFUQ0hJTkdfVEFHUzogMixcclxuICAgICAgICBTUEFXTldFSUdIVF9aRVJPOiA0XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBSb2xsYWJsZU1vZC5BUFBMSUNBQkxFX0JZVEUgPSBBcHBsaWNhYmxlTW9kLkFQUExJQ0FCTEVfQllURTtcclxuICAgIFxyXG4gICAgUm9sbGFibGVNb2QuVU5TQ0FOTkVEID0gMDtcclxuICAgIFJvbGxhYmxlTW9kLlNVQ0NFU1MgPSB0cnVlO1xyXG4gICAgXHJcbiAgICBtb2R1bGUuZXhwb3J0cyA9IFJvbGxhYmxlTW9kO1xyXG59KS5jYWxsKHRoaXMpOyIsIi8qXG4gKiBjb2xsZWN0aW9uIG9mIG1ldGFtb2RzIHRoYXQgYWZmZWN0IHRoZSBjcmFmdGluZyBwcm9jZXNzXG4gKi9cbihmdW5jdGlvbiAoX191bmRlZmluZWQpIHtcbiAgICAndXNlIHN0cmljdCc7XG4gICAgXG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICAgIExPQ0tFRF9QUkVGSVhFUzogNDM0MSxcbiAgICAgICAgTE9DS0VEX1NVRkZJWEVTOiA0MzQyLFxuICAgICAgICBOT19BVFRBQ0tfTU9EUzogNDM0MyxcbiAgICAgICAgTk9fQ0FTVEVSX01PRFM6IDQzNDQsXG4gICAgICAgIE1VTFRJTU9EOiA0MzQ1LFxuICAgICAgICBMTERfTU9EOiA0Mjg4XG4gICAgfTtcbn0pLmNhbGwodGhpcyk7Il19
