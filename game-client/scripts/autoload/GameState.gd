extends Node
## Autoload que gestiona el estado global del jugador, progresión de historia y guardado local.

signal state_changed
signal money_changed(new_amount: int)
signal heat_changed(new_heat: int)
signal chapter_updated(chapter_index: int)

const SAVE_PATH := "user://vidaloca_save.json"

const STORY_CHAPTERS: Array[Dictionary] = [
	{
		"id": 1,
		"title": "Capítulo 1: Luces de Gran Vía",
		"city": "Madrid Centro",
		"objective": "Consigue tu primer contacto nocturno y domina las calles del centro."
	},
	{
		"id": 2,
		"title": "Capítulo 2: Sombras en Lavapiés",
		"city": "Madrid Sur",
		"objective": "Evita las patrullas locales y entrega el paquete en el callejón."
	},
	{
		"id": 3,
		"title": "Capítulo 3: Muelle de Carga",
		"city": "Valencia Puerto",
		"objective": "Intercepta el convoy nocturno en los muelles antes del amanecer."
	},
	{
		"id": 4,
		"title": "Capítulo 4: Asfalto Ardiente",
		"city": "Sevilla Polígono",
		"objective": "Gana la carrera clandestina de derrape sin subir el calor policial."
	},
	{
		"id": 5,
		"title": "Capítulo 5: El Golpe del Estrecho",
		"city": "Costa del Sol",
		"objective": "Consolida tu facción y toma el control definitivo del sindicato."
	}
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
