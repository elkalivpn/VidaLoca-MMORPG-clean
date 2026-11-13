extends Control
## Controlador del Menú Principal de VidaLoca.
## Permite iniciar Modo Historia (Offline), Red Local (Host/Unirse LAN) o Servidor Online (NestJS).

const WORLD_SCENE_PATH := "res://scenes/MadridCentro.tscn"

@onready var status_label: Label = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/StatusLabel
@onready var btn_continue_story: Button = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/OfflinePanel/VBox/BtnContinueStory
@onready var btn_new_story: Button = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/OfflinePanel/VBox/BtnNewStory

@onready var lan_ip_input: LineEdit = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/LanPanel/VBox/LanIpInput
@onready var lan_port_input: LineEdit = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/LanPanel/VBox/LanPortInput
@onready var btn_host_lan: Button = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/LanPanel/VBox/BtnHostLan
@onready var btn_join_lan: Button = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/LanPanel/VBox/BtnJoinLan

@onready var api_url_input: LineEdit = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/OnlinePanel/VBox/ApiUrlInput
@onready var user_input: LineEdit = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/OnlinePanel/VBox/UserInput
@onready var pass_input: LineEdit = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/OnlinePanel/VBox/PassInput
@onready var btn_connect_online: Button = $CenterContainer/MainPanel/MarginContainer/VBoxContainer/ModesGrid/OnlinePanel/VBox/BtnConnectOnline


func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	btn_continue_story.disabled = not GameState.has_save_file()

	btn_continue_story.pressed.connect(_on_continue_story_pressed)
	btn_new_story.pressed.connect(_on_new_story_pressed)
	btn_host_lan.pressed.connect(_on_host_lan_pressed)
	btn_join_lan.pressed.connect(_on_join_lan_pressed)
	btn_connect_online.pressed.connect(_on_connect_online_pressed)

	NetworkManager.lan_connection_succeeded.connect(_on_lan_connected)
	NetworkManager.lan_connection_failed.connect(_on_lan_failed)
	NetworkManager.online_login_completed.connect(_on_online_login_completed)


func _on_continue_story_pressed() -> void:
	NetworkManager.start_offline_story(true)
	_enter_madrid_centro()


func _on_new_story_pressed() -> void:
	NetworkManager.start_offline_story(false)
	_enter_madrid_centro()


func _on_host_lan_pressed() -> void:
	var port := int(lan_port_input.text) if lan_port_input.text.is_valid_int() else 7777
	_set_status("Iniciando servidor LAN en puerto %d..." % port)
	NetworkManager.host_lan_server(port)


func _on_join_lan_pressed() -> void:
	var ip := lan_ip_input.text.strip_edges()
	if ip.is_empty():
		ip = "127.0.0.1"
	var port := int(lan_port_input.text) if lan_port_input.text.is_valid_int() else 7777
	_set_status("Conectando a %s:%d..." % [ip, port])
	NetworkManager.join_lan_server(ip, port)


func _on_connect_online_pressed() -> void:
	var base_url := api_url_input.text.strip_edges()
	var username := user_input.text.strip_edges()
	var password := pass_input.text
	if username.is_empty() or password.is_empty():
		_set_status("Introduce usuario y contraseña para conectar al servidor Online.")
		return
	NetworkManager.set_api_base_url(base_url)
	btn_connect_online.disabled = true
	_set_status("Autenticando en %s..." % base_url)
	NetworkManager.login_online(username, password)


func _on_lan_connected() -> void:
	_enter_madrid_centro()


func _on_lan_failed(reason: String) -> void:
	_set_status("Error LAN: %s" % reason)


func _on_online_login_completed(success: bool, data: Dictionary) -> void:
	btn_connect_online.disabled = false
	if success:
		_set_status("Conectado al servidor Online. Entrando a Madrid Centro...")
		_enter_madrid_centro()
	else:
		_set_status("Error Online: %s" % str(data.get("error", "Credenciales inválidas")))


func _set_status(msg: String) -> void:
	if status_label != null:
		status_label.text = msg


func _enter_madrid_centro() -> void:
	get_tree().change_scene_to_file(WORLD_SCENE_PATH)
