class_name PlayerController
extends CharacterBody3D
## Controlador en 3ª persona para el jugador a pie.
## Soporta cámara orbital suave, sprint, acción táctica [Q] y subir/bajar de vehículo [F].

signal near_vehicle_changed(vehicle: Node3D)
signal tactical_action_triggered(action_name: String)

@export var walk_speed: float = 5.5
@export var sprint_speed: float = 9.5
@export var rotation_speed: float = 10.0
@export var mouse_sensitivity: float = 0.0025
@export var vehicle_enter_radius: float = 4.5

@onready var camera_pivot: Node3D = $CameraPivot
@onready var spring_arm: SpringArm3D = $CameraPivot/SpringArm3D
@onready var camera: Camera3D = $CameraPivot/SpringArm3D/Camera3D
@onready var visual_mesh: Node3D = $VisualMesh
@onready var collision_shape: CollisionShape3D = $CollisionShape3D

var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var is_driving: bool = false
var current_vehicle: VehicleController = null
var _nearby_vehicle: VehicleController = null
var _tactical_cooldown: float = 0.0
var _net_sync_timer: float = 0.0


func _ready() -> void:
	add_to_group("player")
	if camera != null:
		camera.current = true
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _unhandled_input(event: InputEvent) -> void:
	if is_driving:
		return

	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		if camera_pivot != null:
			camera_pivot.rotate_y(-event.relative.x * mouse_sensitivity)
			var pitch := camera_pivot.rotation.x - event.relative.y * mouse_sensitivity
			camera_pivot.rotation.x = clampf(pitch, deg_to_rad(-55.0), deg_to_rad(30.0))

	if event.is_action_pressed("toggle_vehicle"):
		_try_enter_nearby_vehicle()
	elif event.is_action_pressed("fire"):
		_perform_tactical_action()


func _physics_process(delta: float) -> void:
	if _tactical_cooldown > 0.0:
		_tactical_cooldown = maxf(0.0, _tactical_cooldown - delta)

	if is_driving:
		return

	if not is_on_floor():
		velocity.y -= gravity * delta

	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var cam_basis := camera_pivot.global_transform.basis if camera_pivot != null else global_transform.basis
	var forward := -cam_basis.z
	forward.y = 0.0
	forward = forward.normalized()
	var right := cam_basis.x
	right.y = 0.0
	right = right.normalized()

	var move_dir := (right * input_dir.x - forward * input_dir.y).normalized()
	var target_speed := sprint_speed if Input.is_action_pressed("sprint") else walk_speed

	if move_dir.length() > 0.01:
		velocity.x = move_toward(velocity.x, move_dir.x * target_speed, 35.0 * delta)
		velocity.z = move_toward(velocity.z, move_dir.z * target_speed, 35.0 * delta)
		var target_angle := atan2(move_dir.x, move_dir.z)
		if visual_mesh != null:
			visual_mesh.rotation.y = lerp_angle(visual_mesh.rotation.y, target_angle, rotation_speed * delta)
	else:
		velocity.x = move_toward(velocity.x, 0.0, 28.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, 28.0 * delta)

	move_and_slide()
	_detect_nearby_vehicle()

	_net_sync_timer += delta
	if _net_sync_timer >= 0.05:
		_net_sync_timer = 0.0
		var rot_y := visual_mesh.rotation.y if visual_mesh != null else rotation.y
		NetworkManager.broadcast_local_transform(global_position, rot_y, false, velocity.length())


func _detect_nearby_vehicle() -> void:
	var closest: VehicleController = null
	var min_dist := vehicle_enter_radius
	for node in get_tree().get_nodes_in_group("vehicles"):
		if node is VehicleController:
			var dist := global_position.distance_to(node.global_position)
			if dist <= min_dist:
				min_dist = dist
				closest = node

	if closest != _nearby_vehicle:
		_nearby_vehicle = closest
		near_vehicle_changed.emit(_nearby_vehicle)


func _try_enter_nearby_vehicle() -> void:
	if _nearby_vehicle == null:
		return
	is_driving = true
	current_vehicle = _nearby_vehicle
	GameState.is_in_vehicle = true
	visible = false
	if collision_shape != null:
		collision_shape.disabled = true
	current_vehicle.enter_vehicle(self)


func exit_from_vehicle(exit_pos: Vector3) -> void:
	is_driving = false
	current_vehicle = null
	GameState.is_in_vehicle = false
	global_position = exit_pos
	velocity = Vector3.ZERO
	visible = true
	if collision_shape != null:
		collision_shape.disabled = false
	if camera != null:
		camera.current = true
	near_vehicle_changed.emit(null)


func _perform_tactical_action() -> void:
	if _tactical_cooldown > 0.0:
		return
	_tactical_cooldown = 1.25
	tactical_action_triggered.emit("Inspección / Acción Táctica")

	if NetworkManager.current_mode == NetworkManager.ConnectionMode.ONLINE:
		NetworkManager.send_world_action("tactical_action", {
			"district": GameState.current_district,
			"position": [global_position.x, global_position.y, global_position.z]
		})
	else:
		# En modo Offline/LAN otorga una recompensa callejera de prueba y sube el calor policial
		GameState.add_euros(150)
		GameState.add_heat(1)
		if NetworkManager.current_mode == NetworkManager.ConnectionMode.OFFLINE:
			GameState.save_game()
