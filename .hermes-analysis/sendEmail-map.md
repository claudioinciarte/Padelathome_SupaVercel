# MAPEO SENDEMAIL — Padel@Home

## Resumen: 11 llamadas en 8 archivos, 7 tipos únicos

| # | Tipo (clave) | Archivo | Función/Línea | Asunto literal | Var llamada |
|---|---|---|---|---|---|
| 1 | booking.confirm | bookingController.js | createBooking L141 | `Confirmación de Reserva en Padel@Home para el ${bookingStartTime.toLocaleDateString('es-ES')}` | user.name, user.email, courtName, bookingStartTime |
| 2 | waitlist.slot | bookingController.js | cancelMyBooking L259 | `¡Un hueco se ha liberado en Padel@Home!` | luckyUser.user_name, luckyUser.user_email, luckyUser.slot_start_time, confirmationUrl |
| 3 | waitlist.slot | cronController.js | processExpiredWaitlistEntries L181 | `¡Un hueco se ha liberado en Padel@Home!` | nextUser.user_name, nextUser.user_email, confirmationUrl |
| 4 | waitlist.slot | checkWaitingList.js | processExpiredWaitlistEntries L53 | `¡Un hueco se ha liberado en Padel@Home!` | nextUser.user_name, nextUser.user_email, confirmationUrl |
| 5 | match.cancel | matchController.js | leaveOpenMatch L161 | `Cancelación de Partida Abierta - Padel@Home` | participant.name, participant.email, formattedDate, autoCancelHoursBefore |
| 6 | match.cancel | cronController.js | cleanIncompleteOpenMatches L92 | `Cancelación de Partida Abierta - Padel@Home` | participant.name, participant.email, formattedDate, booking.target_players |
| 7 | match.cancel | checkOpenMatches.js | cancelIncompleteMatches L48 | `Partida Abierta Cancelada en Padel@Home` | user.name, user.email, match.start_time, match.max_participants, match.auto_cancel_hours_before |
| 8 | account.approved | adminController.js | approveUser L53 | `¡Tu cuenta en Padel@Home ha sido aprobada!` | approvedUser.name, approvedUser.email |
| 9 | account.welcome | adminController.js | inviteUser L94 | `¡Bienvenido a Padel@Home! Establece tu contraseña` | newUser.name, newUser.email, setPasswordUrl |
| 10 | password.reset | adminController.js | resetUserPassword L127 | `Restablecimiento de Contraseña para Padel@Home` | user.name, user.email, setPasswordUrl |
| 11 | auth.password-reset | authController.js | forgotPassword L95 | `Restablece tu contraseña de Padel@Home` | user.name, user.email, resetUrl |

## Duplicados

- **waitlist.slot** (#2, #3, #4): 3 copias del mismo tipo. Asunto idéntico. HTML distinto:
  - #2 incluye `slot_start_time` (fecha del slot liberado): `"Se ha liberado el horario por el que estabas esperando (${new Date(luckyUser.slot_start_time).toLocaleString('es-ES')})."`
  - #3 y #4 no incluyen la fecha del slot: `"El turno anterior ha expirado. ¡Ahora es tu oportunidad!"`. Son idénticos entre sí.
  - Variable del nombre: #2 usa `luckyUser.user_name`, #3 y #4 usan `nextUser.user_name`.

- **match.cancel** (#5, #6, #7): 3 copias. Asuntos ligeramente distintos:
  - #5 y #6: `Cancelación de Partida Abierta - Padel@Home` (idéntico).
  - #7: `Partida Abierta Cancelada en Padel@Home` (distinto).
  - HTML del cuerpo: #5 y #6 son casi idénticos (motivo: jugador abandonó <N horas). #7 distinto (motivo: no alcanzó mínimo de jugadores).
  - Variables: #5 usa `autoCancelHoursBefore`, `formattedDate`. #6 usa `booking.target_players`, `formattedDate`. #7 usa `match.max_participants`, `match.auto_cancel_hours_before`, `match.start_time`.
