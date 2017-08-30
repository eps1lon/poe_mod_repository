# Disclaimer
This is an example as to how i get the `js/data/*.json` files. There are many
different ways but the important part is that you keep the format as described
in the `*.sql` files. You can user whatever DSL you like.

When new patch (content.ggpk update) hits:
## Steps
1. get newest configspec
2. move configspec to pypoe and poe_db
4. sudo pypoe_ui
 1. extract `DATA`, `MetaData` (might take a while)
5. pypoe_exporter dat json > poe_db
6. cp `MetaData`/*_descriptions.txt > poe_db/data/translations/raw/
7. poe_db
 1. `ini2json.php > config.json`
 2. `import_json.php`
 3. `translation2json.php > poe_mod_repository/js/data/translations`
8. poe_mod_repository/tasks
 1. data/export.php
 2. export_mod_containers.php
 3. move temp files to respective js/data destination
 4. node mod_correct_group_translation
