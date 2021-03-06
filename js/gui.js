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
    var MasterMod           = require('./libs/mods/MasterMod');
    var Spawnable           = require('./libs/Spawnable');
    var DataDependency      = require('./libs/DataDependency');
    var Localization        = require('./libs/Localization');
    var Hashbang            = require('./libs/Hashbang');
    var ByteSet             = require('./libs/ByteSet');
    var NotFoundException   = require('./libs/Exceptions/NotFoundException');
    var ValueRange          = require('./libs/ValueRange');
    
    require('./libs/concerns/Array');
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
        $statsgroup.append(baseitem.itemclassName());
        
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
            var value_string;
            if (value instanceof ValueRange) {
                value_string = value.toString(0, 2);
            } else {
                value_string = value.toString();
            }
            
            $statsgroup.append("<br>", stat_desc, ": ", "<span class='text-value'>" + value_string + "</span>");
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
        
        // display corruption state
        if (baseitem.isCorrupted()) {
            $(".itembox-statsgroup:last", $itembox).append("<br><span class='text-corrupted'>Corrupted</span>");
        }
        
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
        var whitelist = [
            'LOWER_ILVL',
            'DOMAIN_FULL',
            'ALREADY_PRESENT',
            'NO_MULTIMOD',
            'ABOVE_LLD_LEVEL'
        ];
        
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
        }),
        $.ready
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
        ByteSet.localization = {};
        
        $("ul.legend", $('#legends')).each(function () {
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
        
        var game_version = require('./data/game_version');
        $('#game_version').text(game_version.version + '.' + game_version.clients[game_version.client]);
        
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
            if (item_class === __undefined) {
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
                rings: 'RINGS',
                amulets: 'AMULETS',
                belts: 'BELTS',
                jewels: 'JEWEL',
                claws: 'CLAWS',
                daggers: 'DAGGERS',
                bows: 'BOWS',
                quivers: 'QUIVERS',
                staves: 'STAVES',
                sceptres: 'SCEPTRES',
                wands: 'WANDS',
                '1h_axes': 'ONE_HAND_AXES',
                '2h_axes': 'TWO_HAND_AXES',
                '1h_maces': 'ONE_HAND_MACES',
                '2h_maces': 'TWO_HAND_MACES',
                '1h_swords': 'ONE_HAND_SWORDS',
                '1h_swords_thrusting': 'THRUSTING_ONE_HAND_SWORDS',
                '2h_swords': 'TWO_HAND_SWORDS',
                'maps': 'MAPS',
                armours: 'BODY_ARMOURS',
                gloves: 'GLOVES',
                boots: 'BOOTS',
                helmets: 'HELMETS',
                shields: 'SHIELDS'
            };
            var $baseitem;
            var sub_tag = '';
            
            // itemclass
            next_file = this.getPath().nextFile();
            
            if (mappings[next_file]) {
                $('#item_classes .item_class.' + mappings[next_file]).prop("selected", true);
            } else {
                $('#item_classes .item_class.RINGS').prop("selected", true);
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
                    $('#baseitems').trigger("change");

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
            
            return true;
        };

        hashbang.onChange(hashbang_change);
        
        $(window).on("hashchange", function () {
            if (Hashbang.windowHasHashbang(window)) {
                hashbang.withWindow(window).triggerChange();
            }
        });
        
        $(window).trigger("hashchange");

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
            return false;
        });
        
        $("#show_masterbenches").on("click", function () {
            $("#ModGenerator fieldset.masterbenches").toggle();
            return false;
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