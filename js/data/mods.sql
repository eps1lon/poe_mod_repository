SELECT m.Rows as Rows, m.Id, m.ModTypeKey, m.Level, m.Domain, m.Name, m.GenerationType, 
    m.CorrectGroup, m.Stat1Min, m.Stat1Max, m.Stat2Min, m.Stat2Max, 
    m.Stat3Min, m.Stat3Max, m.Stat4Min, m.Stat4Max, m.Stat5Min, m.Stat5Max, 
    CONCAT(IFNULL(s1.Rows, 'null'), ',', IFNULL(s2.Rows, 'null'), ',', IFNULL(s3.Rows, 'null'), ',', IFNULL(s4.Rows, 'null'), ',', IFNULL(s5.Rows, 'null')) as Stats,
    m.SpawnWeight_TagsKeys, m.SpawnWeight_Values, m.TagsKeys, m.GrantedEffectsPerLevelKey
FROM `mods` AS m
LEFT JOIN stats AS s1 ON m.StatsKey1 = s1.Rows 
LEFT JOIN stats AS s2 ON m.StatsKey2 = s2.Rows 
LEFT JOIN stats AS s3 ON m.StatsKey3 = s3.Rows 
LEFT JOIN stats AS s4 ON m.StatsKey4 = s4.Rows 
LEFT JOIN stats AS s5 ON m.StatsKey5 = s5.Rows 
GROUP BY m.Rows