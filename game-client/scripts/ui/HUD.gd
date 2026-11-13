extends CanvasLayer
## HUD en vivo para MadridCentro: km/h, badge DRIFT, Euros, Calor policial, Modo de red y Prompts.

@onready var mode_label: Label = $TopBar/HBox/LeftBox/ModeLabel
@onready var chapter_label: Label = $TopBar/HBox/LeftBox/ChapterLabel
@onready var euros_label: Label = $TopBar/HBox/RightBox/EurosLabel
@onready var heat_label: Label = $TopBar/HBox/RightBox/HeatLabel
@onready var prompt_label: Label = $BottomCenter/PromptLabel
@onready var speed_label: Label = $BottomRight/VBox/SpeedLabel
@onready var drift_badge: PanelContainer = $BottomRight/VBox/DriftBadge
@onready var vehicle_panel: Control = $BottomRight


func _ready() -> void:
	GameState.state_changed.connect(_refresh_player_stats)
	GameState.money_changed.connect(func(_v: int) -> void: _refresh_player_stats())
	GameState.heat_changed.connect(func(_v: int) -> void: _refresh_player_stats())
	GameState.chapter_updated.connect(func(_v: int) -> void: _refresh_player_stats())
	NetworkManager.mode_changed.connect(func(_m: int) -> void: _refresh_player_stats())

	_refresh_player_stats()
	update_vehicle_telemetry(0.0, false, false)
	set_prompt("")


func _refresh_player_stats() -> void:
	if mode_label != null:
		mode_label.text = "MODO: %s | %s" % [NetworkManager.get_mode_label(), GameState.current_district]

	if chapter_label != null:
		if NetworkManager.current_mode == NetworkManager.ConnectionMode.OFFLINE:
			var ch := GameState.get_current_chapter_info()
			chapter_label.text = "%s — %s" % [ch.get("title", ""), ch.get("objective", "")]
			chapter_label.visible = true
		else:
			chapter_label.text = "Jugador: %s | Facción: %s" % [GameState.player_name, GameState.faction]
			chapter_label.visible = true

	if euros_label != null:
		euros_label.text = "€ %d" % GameState.euros

	if heat_label != null:
		var stars := ""
		for i in range(5):
			stars += "★" if i < GameState.heat else "☆"
		heat_label.text = "CALOR: %s" % stars


func update_vehicle_telemetry(speed_kmh: float, is_drifting: bool, in_vehicle: bool) -> void:
	if vehicle_panel != null:
		vehicle_panel.visible = in_vehicle
	if speed_label != null:
		speed_label.text = "%d km/h" % roundi(speed_kmh)
	if drift_badge != null:
		drift_badge.visible = is_drifting


func set_prompt(text: String) -> void:
	if prompt_label != null:
		prompt_label.text = text
		prompt_label.visible = not text.is_empty()
