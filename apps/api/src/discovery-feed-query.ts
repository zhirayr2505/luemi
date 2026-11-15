/**
 * Canonical SQL for the authenticated published-only discovery feed.
 *
 * Keep this query shared by the API route and disposable EXPLAIN benchmarks,
 * so the benchmark always analyzes the same SQL the application executes.
 */
export const DISCOVERY_FEED_QUERY =
"WITH preference AS (SELECT owner_gender,owner_birth_date,audience,age_min,age_max,city_label,country_code,goal,interests,search_scope "+
    "FROM luemi_private.discovery_preferences WHERE owner_id=$2 AND environment=$1 UNION ALL "+
    "SELECT NULL::text,NULL::date,'everyone'::text,18::smallint,80::smallint,''::text,''::text,''::text,ARRAY[]::text[],'world'::text "+
    "WHERE NOT EXISTS(SELECT 1 FROM luemi_private.discovery_preferences WHERE owner_id=$2 AND environment=$1)) "+
    "SELECT p.owner_id,p.display_name,p.city_label,p.country_code,p.about,p.interests,"+
    "p.gender,p.goal,p.languages,p.birth_date::text,p.published_at::text,"+
    "incoming.kind AS liked_you_kind,evidence.km AS distance_km "+
    "FROM luemi_private.public_profiles p CROSS JOIN preference pref "+
    "LEFT JOIN luemi_private.city_centres origin_city ON origin_city.country_code=pref.country_code::char(2) "+
    "AND origin_city.city_norm=lower(btrim(pref.city_label)) "+
    "LEFT JOIN luemi_private.city_centres candidate_city ON candidate_city.country_code=p.country_code::char(2) "+
    "AND candidate_city.city_norm=lower(btrim(p.city_label)) "+    "LEFT JOIN luemi_private.precise_locations viewer_loc ON "+
    "viewer_loc.owner_id=$2 AND viewer_loc.environment=$1 "+
    "LEFT JOIN luemi_private.precise_locations candidate_loc ON "+
    "candidate_loc.owner_id=p.owner_id AND candidate_loc.environment=$1 "+


    // Only coarse declared city centres are used: never precise device GPS.
    // Evidence and ranking are evaluated by PostgreSQL BEFORE LIMIT/OFFSET,
    // so later pages cannot jump ahead of better matches on earlier pages.
    "CROSS JOIN LATERAL (SELECT "+
    "CASE WHEN viewer_loc.owner_id IS NOT NULL AND candidate_loc.owner_id IS NOT NULL THEN "+
    "6371.0088*2*asin(sqrt(least(1.0,"+
    "power(sin(radians(candidate_loc.coarse_lat-viewer_loc.coarse_lat)/2),2)+"+
    "cos(radians(viewer_loc.coarse_lat))*cos(radians(candidate_loc.coarse_lat))*"+
    "power(sin(radians(candidate_loc.coarse_lon-viewer_loc.coarse_lon)/2),2)))) "+
    "WHEN lower(btrim(p.city_label))=lower(btrim(pref.city_label)) "+
    "AND p.country_code=pref.country_code THEN 0::double precision "+
    "WHEN coalesce(viewer_loc.coarse_lat,origin_city.lat) IS NULL "+
    "OR coalesce(candidate_loc.coarse_lat,candidate_city.lat) IS NULL THEN NULL::double precision "+
    "ELSE 6371.0088*2*asin(sqrt(least(1.0,"+
    "power(sin(radians(coalesce(candidate_loc.coarse_lat,candidate_city.lat)-"+
    "coalesce(viewer_loc.coarse_lat,origin_city.lat))/2),2)+"+
    "cos(radians(coalesce(viewer_loc.coarse_lat,origin_city.lat)))*"+
    "cos(radians(coalesce(candidate_loc.coarse_lat,candidate_city.lat)))*"+
    "power(sin(radians(coalesce(candidate_loc.coarse_lon,candidate_city.lon)-"+
    "coalesce(viewer_loc.coarse_lon,origin_city.lon))/2),2)))) END AS km,"+
    "cardinality(ARRAY(SELECT unnest(p.interests) INTERSECT "+
    "SELECT unnest(pref.interests))) AS shared,"+
    "CASE WHEN pref.goal='undecided' OR p.goal='undecided' THEN 0 "+
    "WHEN p.goal=pref.goal THEN 2 "+
    "WHEN pref.goal IN ('serious','relationship','love','family_goal') "+
    "AND p.goal IN ('serious','relationship','love','family_goal') THEN 1 "+
    "WHEN pref.goal IN ('dates','flirt','casual') "+
    "AND p.goal IN ('dates','flirt','casual') THEN 1 "+
    "WHEN pref.goal IN ('friendship','communication','new_people') "+
    "AND p.goal IN ('friendship','communication','new_people') THEN 1 "+
    "WHEN pref.goal IN ('activities','travel_partner') "+
    "AND p.goal IN ('activities','travel_partner') THEN 1 "+
    "ELSE 0 END AS goal_score) evidence "+
    "CROSS JOIN LATERAL (SELECT "+
    "CASE WHEN evidence.goal_score=2 AND evidence.shared>=2 THEN 4 "+
    "WHEN evidence.goal_score>0 AND evidence.shared>=1 THEN 3 "+
    "WHEN evidence.goal_score=2 OR evidence.shared>=2 THEN 2 "+
    "WHEN evidence.goal_score=1 OR evidence.shared=1 THEN 1 ELSE 0 END AS tier,"+
    "(evidence.goal_score*4 + least(evidence.shared,6)*2) AS score,"+
    "CASE WHEN evidence.km IS NULL THEN 9 WHEN evidence.km<=25 THEN 0 "+
    "WHEN evidence.km<=100 THEN 1 WHEN evidence.km<=300 THEN 2 "+
    "WHEN evidence.km<=1000 THEN 3 WHEN evidence.km<=3000 THEN 4 "+
    "ELSE 5 END AS band) ranking "+
    "LEFT JOIN luemi_chats.likes incoming ON incoming.environment=p.environment "+
    "AND incoming.sender_id=p.owner_id AND incoming.receiver_id=$2 AND incoming.status='active' "+
    "WHERE p.environment=$1 "+
    "AND (pref.search_scope<>'city' OR (lower(btrim(p.city_label))=lower(btrim(pref.city_label)) AND p.country_code=pref.country_code)) "+
    "AND (pref.search_scope<>'country' OR p.country_code=pref.country_code) "+
    "AND p.owner_id<>$2 AND p.publication_status='published' AND p.published_at IS NOT NULL "+
    "AND (pref.audience='everyone' OR (pref.audience='women' AND p.gender='woman') "+
    "OR (pref.audience='men' AND p.gender='man')) "+
    "AND date_part('year',age(current_date,p.birth_date))::int BETWEEN pref.age_min AND pref.age_max "+
    "AND (pref.owner_gender IS NULL OR p.audience='everyone' OR (p.audience='women' AND pref.owner_gender='woman') "+
    "OR (p.audience='men' AND pref.owner_gender='man')) "+
    "AND (pref.owner_birth_date IS NULL OR date_part('year',age(current_date,pref.owner_birth_date))::int "+
    "BETWEEN p.preferred_age_min AND p.preferred_age_max) "+
    "AND NOT EXISTS(SELECT 1 FROM luemi_chats.likes sent WHERE sent.environment=p.environment "+
    "AND sent.sender_id=$2 AND sent.receiver_id=p.owner_id) "+
    "AND (SELECT count(*) FROM luemi_private.media_assets a WHERE a.owner_id=p.owner_id "+
    "AND a.environment=p.environment AND a.state='approved' "+
    "AND a.publication_status='published') BETWEEN 3 AND 6 "+
    // Nearby: match compatibility first within a local 100km area, then expand
    // through wider area bands. City: strict locality. World: expand outward
    // through city-distance bands, prioritize affinity inside each band.
    // Unknown city coordinates remain discoverable and rank after known places.
    "ORDER BY CASE WHEN pref.search_scope='world' THEN ranking.band "+
    "WHEN pref.search_scope='radius' THEN CASE "+
    "WHEN evidence.km IS NULL THEN 9 WHEN evidence.km<=100 THEN 0 "+
    "WHEN evidence.km<=300 THEN 1 WHEN evidence.km<=1000 THEN 2 "+
    "WHEN evidence.km<=3000 THEN 3 ELSE 4 END END ASC NULLS LAST,"+
    "ranking.tier DESC,ranking.score DESC,"+
    "CASE WHEN pref.search_scope IN ('radius','world') THEN evidence.km END ASC NULLS LAST,"+
    "(lower(btrim(p.city_label))=lower(btrim(pref.city_label)) AND p.country_code=pref.country_code) DESC,"+
    "(p.country_code=pref.country_code) DESC,p.published_at DESC,p.owner_id DESC OFFSET $3 LIMIT 21";
