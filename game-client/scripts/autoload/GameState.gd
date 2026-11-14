extends Node
## Autoload que gestiona el estado global del jugador, progresión de historia y guardado local.

signal state_changed
signal money_changed(new_amount: int)
signal heat_changed(new_heat: int)
signal chapter_updated(chapter_index: int)

const SAVE_PATH := "user://vidaloca_save.json"

const STORY_CHAPTERS: Array[Dictionary] = [
	{"id": 1, "title": "Cap. 1: Luces de Gran Vía", "city": "Madrid Centro", "optional": true, "benefit": "+450 XP + Chaleco II", "objective": "Establece tu primer contacto nocturno en Madrid Centro."},
	{"id": 2, "title": "Cap. 2: Sombras en Malasaña", "city": "Malasaña (Madrid)", "optional": true, "benefit": "+700 XP + Glock 19", "objective": "Recupera el maletín cifrado esquivando patrullas."},
	{"id": 3, "title": "Cap. 3: Murallas de Toledo", "city": "Toledo Alcázar", "optional": true, "benefit": "+950 XP + Nitro N2O", "objective": "Negocia paso seguro por los túneles del Alcázar sobre el Tajo."},
	{"id": 4, "title": "Cap. 4: Convoy del Pisuerga", "city": "Valladolid", "optional": true, "benefit": "+1.400 XP + Remington 870", "objective": "Intercepta rutas logísticas en el corazón de Castilla."},
	{"id": 5, "title": "Cap. 5: Pacto en Salamanca", "city": "Salamanca Plaza Mayor", "optional": true, "benefit": "+1.850 XP + Kit Derrape", "objective": "Cierra el acuerdo nocturno hacia la frontera oeste."},
	{"id": 6, "title": "Cap. 6: Corredor del Ebro", "city": "Zaragoza Delicias", "optional": true, "benefit": "+2.400 XP + SIG P226", "objective": "Desmantela el peaje clandestino entre Madrid y Barcelona."},
	{"id": 7, "title": "Cap. 7: Niebla en la Ría", "city": "Puerto de Vigo (Galicia)", "optional": true, "benefit": "+3.100 XP + HK MP5A3", "objective": "Sigue la descarga furtiva frente a las Islas Cíes."},
	{"id": 8, "title": "Cap. 8: Soportales de Santiago", "city": "Santiago de Compostela", "optional": true, "benefit": "+3.600 XP + Chaleco IIIA", "objective": "Descifra los libros contables ocultos bajo la tormenta."},
	{"id": 9, "title": "Cap. 9: Navieras de A Coruña", "city": "A Coruña Marina", "optional": true, "benefit": "+4.400 XP + AK-47", "objective": "Asegura el muelle estratégico atlántico."},
	{"id": 10, "title": "Cap. 10: Acero en Bilbao", "city": "Bilbao Abando (País Vasco)", "optional": true, "benefit": "+5.400 XP + Suspensión Racing", "objective": "Infiltración corporativa en la ría de Bilbao."},
	{"id": 11, "title": "Cap. 11: Cruce de Vitoria", "city": "Vitoria-Gasteiz", "optional": true, "benefit": "+6.400 XP + Desert Eagle", "objective": "Corta las rutas del eje norte en Álava."},
	{"id": 12, "title": "Cap. 12: Gala de La Concha", "city": "San Sebastián", "optional": true, "benefit": "+7.600 XP + FN P90", "objective": "Golpe de guante blanco junto a la bahía donostiarra."},
	{"id": 13, "title": "Cap. 13: Las Ramblas", "city": "Barcelona", "optional": true, "benefit": "+9.000 XP + Benelli M4", "objective": "Desvía el envío blindado hacia el puerto mediterráneo."},
	{"id": 14, "title": "Cap. 14: Regata en Palma", "city": "Palma de Mallorca (Baleares)", "optional": true, "benefit": "+11.000 XP + Chaleco IV", "objective": "Cruza a Baleares e intercepta cuentas offshore."},
	{"id": 15, "title": "Cap. 15: Dalt Vila Nocturna", "city": "Ibiza (Baleares)", "optional": true, "benefit": "+13.500 XP + HK416 D", "objective": "Operación VIP entre villas blindadas y pistas privadas."},
	{"id": 16, "title": "Cap. 16: Puerto de La Luz", "city": "Las Palmas (Canarias)", "optional": true, "benefit": "+17.000 XP + Kit Biturbo", "objective": "Domina el nodo tricontinental atlántico en Gran Canaria."},
	{"id": 17, "title": "Cap. 17: Sombra del Teide", "city": "Tenerife (Canarias)", "optional": true, "benefit": "+22.000 XP + SCAR-H CQC", "objective": "Persecución por carreteras volcánicas hasta Anaga."},
	{"id": 18, "title": "Cap. 18: Corona Ibérica", "city": "Marbella / Puerto Banús", "optional": true, "benefit": "+32.000 XP + Leyenda", "objective": "Unifica la red peninsular e insular bajo tu sindicato."}
]

var player_name: String = "ElNómada"
var euros: int = 2500
var heat: int = 0
var faction: String = "Independiente"
var current_district: String = "Madrid Centro"
var current_chapter: int = 1
var is_in_vehicle: bool = false
var story_completed: bool = false


func _ready() -> void:
	if has_save_file():
		load_game()


func get_current_chapter_info() -> Dictionary:
	var idx := clampi(current_chapter - 1, 0, STORY_CHAPTERS.size() - 1)
	return STORY_CHAPTERS[idx]


func add_euros(amount: int) -> void:
	euros = maxi(0, euros + amount)
	money_changed.emit(euros)
	state_changed.emit()


func set_euros(amount: int) -> void:
	euros = maxi(0, amount)
	money_changed.emit(euros)
	state_changed.emit()


func add_heat(delta: int) -> void:
	heat = clampi(heat + delta, 0, 5)
	heat_changed.emit(heat)
	state_changed.emit()


func set_heat(value: int) -> void:
	heat = clampi(value, 0, 5)
	heat_changed.emit(heat)
	state_changed.emit()


func advance_chapter() -> void:
	if current_chapter < STORY_CHAPTERS.size():
		current_chapter += 1
		current_district = get_current_chapter_info().get("city", current_district)
	else:
		story_completed = true
	chapter_updated.emit(current_chapter)
	state_changed.emit()
	save_game()


func reset_story() -> void:
	player_name = "ElNómada"
	euros = 2500
	heat = 0
	faction = "Independiente"
	current_district = "Madrid Centro"
	current_chapter = 1
	is_in_vehicle = false
	story_completed = false
	save_game()
	money_changed.emit(euros)
	heat_changed.emit(heat)
	chapter_updated.emit(current_chapter)
	state_changed.emit()


func has_save_file() -> bool:
	return FileAccess.file_exists(SAVE_PATH)


func save_game() -> bool:
	var payload := {
		"version": 1,
		"player_name": player_name,
		"euros": euros,
		"heat": heat,
		"faction": faction,
		"current_district": current_district,
		"current_chapter": current_chapter,
		"story_completed": story_completed,
		"saved_at": Time.get_datetime_string_from_system(true)
	}
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		push_warning("GameState: No se pudo guardar en %s" % SAVE_PATH)
		return false
	file.store_string(JSON.stringify(payload, "\t"))
	file.close()
	return true


func load_game() -> bool:
	if not has_save_file():
		return false
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return false
	var raw := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(raw)
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("GameState: Archivo de guardado corrupto.")
		return false
	var data: Dictionary = parsed
	player_name = str(data.get("player_name", "ElNómada"))
	euros = int(data.get("euros", 2500))
	heat = clampi(int(data.get("heat", 0)), 0, 5)
	faction = str(data.get("faction", "Independiente"))
	current_district = str(data.get("current_district", "Madrid Centro"))
	current_chapter = clampi(int(data.get("current_chapter", 1)), 1, STORY_CHAPTERS.size())
	story_completed = bool(data.get("story_completed", false))
	money_changed.emit(euros)
	heat_changed.emit(heat)
	chapter_updated.emit(current_chapter)
	state_changed.emit()
	return true
