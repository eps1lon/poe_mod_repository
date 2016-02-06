SELECT CorrectGroup as `primary`, 'init_empty_string' as init_mode, 128 as json_options FROM `mods` WHERE GenerationType != 3 GROUP BY CorrectGroup
