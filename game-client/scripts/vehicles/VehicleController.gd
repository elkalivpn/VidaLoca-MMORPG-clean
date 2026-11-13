class_name VehicleController
extends VehicleBody3D
## Controlador de superdeportivo sobre VehicleBody3D con 4 VehicleWheel3D.
## Incluye tracción trasera, dirección suavizada, freno, derrape con [Space] y cálculo de km/h.

signal telemetry_updated(speed_kmh: float, is_drifting: bool)
signal driver_changed(has_driver: bool)

@export var max_engine_force: float = 340.0
@export var reverse_force: float = 180.0
@export var max_brake_force: float = 16.0
@export var max_steer_angle: float = 0.48
@export var steer_speed: float = 4.5
@export var normal_rear_friction: float = 3.2
@export var drift_rear_friction: float = 1.1
@export var base_fov: float = 72.0
@export var max_fov: float = 92.0

@onready var wheel_fl: VehicleWheel3D = $WheelFL
@onready var wheel_fr: VehicleWheel3D = $WheelFR
@onready var wheel_rl: VehicleWheel3D = $WheelRL
@onready var wheel_rr: VehicleWheel3D = $WheelRR
@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera: Camera3D = $CameraPivot/SpringArm3D/Camera3D

var driver: PlayerController = null
var is_drifting: bool = false
var current_speed_kmh: float = 0.0
var _net_sync_timer: float = 0.0


func _ready() -> void:
	add_to_group("vehicles")
	if wheel_rl != null:
		wheel_rl.wheel_friction_slip = normal_rear_friction
	if wheel_rr != null:
		wheel_rr.wheel_friction_slip = normal_rear_friction


func _unhandled_input(event: InputEvent) -> void:
	if driver == null:
		return
	if event.is_action_pressed("toggle_vehicle"):
		exit_vehicle()


func _physics_process(delta: float) -> void:
	current_speed_kmh = linear_velocity.length() * 3.6

	if driver == null:
		engine_force = 0.0
		brake = 6.0
		steering = move_toward(steering, 0.0, steer_speed * delta)
		is_drifting = false
		return

	var throttle := Input.get_axis("move_back", "move_forward")
	var steer_input := Input.get_axis("move_right", "move_left")
	var wants_drift := Input.is_action_pressed("drift")

	# Dirección progresiva
	var target_steer := steer_input * max_steer_angle
	steering = move_toward(steering, target_steer, steer_speed * delta)

	# Aceleración y freno
	if throttle > 0.05:
		engine_force = throttle * max_engine_force
		brake = 0.0
	elif throttle < -0.05:
		var forward_speed := linear_velocity.dot(global_transform.basis.z)
		if forward_speed > 2.0:
			engine_force = 0.0
			brake = max_brake_force
		else:
			engine_force = throttle * reverse_force
			brake = 0.0
	else:
		engine_force = 0.0
		brake = 0.8

	# Sistema de derrape reduciendo wheel_friction_slip trasero
	var target_rear_friction := drift_rear_friction if wants_drift else normal_rear_friction
	if wheel_rl != null:
		wheel_rl.wheel_friction_slip = move_toward(wheel_rl.wheel_friction_slip, target_rear_friction, 8.0 * delta)
	if wheel_rr != null:
		wheel_rr.wheel_friction_slip = move_toward(wheel_rr.wheel_friction_slip, target_rear_friction, 8.0 * delta)

	is_drifting = wants_drift and current_speed_kmh > 18.0 and absf(steer_input) > 0.1

	# Cámara dinámica según velocidad
	if camera != null:
		var speed_ratio := clampf(current_speed_kmh / 180.0, 0.0, 1.0)
		camera.fov = lerpf(camera.fov, lerpf(base_fov, max_fov, speed_ratio), 5.0 * delta)

	telemetry_updated.emit(current_speed_kmh, is_drifting)

	# Sincronización LAN
	_net_sync_timer += delta
	if _net_sync_timer >= 0.05:
		_net_sync_timer = 0.0
		NetworkManager.broadcast_local_transform(global_position, rotation.y, true, current_speed_kmh)


func enter_vehicle(new_driver: PlayerController) -> void:
	driver = new_driver
	if camera != null:
		camera.current = true
	driver_changed.emit(true)
	telemetry_updated.emit(current_speed_kmh, false)


func exit_vehicle() -> void:
	if driver == null:
		return
	var exiting_driver := driver
	driver = null
	is_drifting = false
	var exit_pos := global_position + global_transform.basis.x * 2.4 + Vector3(0.0, 0.4, 0.0)
	exiting_driver.exit_from_vehicle(exit_pos)
	driver_changed.emit(false)
	telemetry_updated.emit(0.0, false)
