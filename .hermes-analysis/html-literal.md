# HTML LITERAL Y ASUNTOS — 7 TIPOS DE CORREO

## 1. booking.confirm (bookingController.js L141-146)
Asunto: `Confirmación de Reserva en Padel@Home para el {{date}}`
HTML:
```
<h3>¡Hola, {{name}}!</h3><p>Tu reserva ha sido confirmada. Adjuntamos un evento de calendario.</p>
```
Variables contexto: name, email, courtName, date
Notas: El asunto incluye la fecha (bookingStartTime.toLocaleDateString('es-ES')). El .ics se adjunta aparte (NO va en la plantilla). El event del .ics usa courtName y user.name en description.

## 2. waitlist.slot — variante A (bookingController.js L259-263)
Asunto: `¡Un hueco se ha liberado en Padel@Home!`
HTML:
```
<h3>¡Hola, {{userName}}!</h3><p>Se ha liberado el horario por el que estabas esperando ({{slotDate}}).</p><p>Tienes <strong>30 minutos</strong> para confirmar la reserva haciendo clic en el siguiente enlace. Después, tu turno expirará.</p><a href="{{confirmationUrl}}">Confirmar mi Reserva</a>
```
Variables contexto: userName, userEmail, slotDate, confirmationUrl
Notas: slotDate = new Date(luckyUser.slot_start_time).toLocaleString('es-ES')

## 3. waitlist.slot — variante B (cronController.js L181-185 Y checkWaitingList.js L53-57)
Asunto: `¡Un hueco se ha liberado en Padel@Home!`
HTML:
```
<h3>¡Hola, {{userName}}!</h3><p>El turno anterior ha expirado. ¡Ahora es tu oportunidad!</p><p>Tienes <strong>30 minutos</strong> para confirmar la reserva haciendo clic en el enlace.</p><a href="{{confirmationUrl}}">Confirmar mi Reserva</a>
```
Variables contexto: userName, userEmail, confirmationUrl
Notas: Igual en cronController y checkWaitingList.js. No incluye slotDate.

## 4. match.cancel — variante A (matchController.js L161-171)
Asunto: `Cancelación de Partida Abierta - Padel@Home`
HTML:
```
<h3>Hola {{name}},</h3>
<p>Te informamos que la partida abierta programada para el <strong>{{formattedDate}}</strong> ha sido cancelada.</p>
<p>El motivo es que un jugador ha abandonado la partida quedando menos de {{autoCancelHoursBefore}} horas para el inicio, por lo que el sistema la ha cancelado automáticamente.</p>
<p>Disculpa las molestias.</p>
<p>Atentamente,<br>El equipo de Padel@Home</p>
```
Variables contexto: name, email, formattedDate, autoCancelHoursBefore
Notas: formattedDate = new Date(booking.start_time).toLocaleString('es-ES', { timeZone: 'UTC' }). autoCancelHoursBefore = booking.auto_cancel_hours_before || 6

## 5. match.cancel — variante B (cronController.js L92-102)
Asunto: `Cancelación de Partida Abierta - Padel@Home`
HTML:
```
<h3>Hola {{name}},</h3>
<p>Te informamos que la partida abierta programada para el <strong>{{formattedDate}}</strong> ha sido cancelada.</p>
<p>El motivo es que no se alcanzó el número mínimo de jugadores requeridos ({{targetPlayers}}) para realizar el encuentro.</p>
<p>Disculpa las molestias y esperamos verte pronto en otra partida.</p>
<p>Atentamente,<br>El equipo de Padel@Home</p>
```
Variables contexto: name, email, formattedDate, targetPlayers
Notas: formattedDate = new Date(booking.start_time).toLocaleString('es-ES', { timeZone: 'UTC' }). targetPlayers = booking.target_players (COALESCE max_participants, 4)

## 6. match.cancel — variante C (checkOpenMatches.js L48-56)
Asunto: `Partida Abierta Cancelada en Padel@Home`
HTML:
```
<h3>Hola, {{name}}</h3>
<p>La partida abierta programada para el {{formattedDate}} ha sido
cancelada automáticamente porque no se ha alcanzado el mínimo de {{maxParticipants}} jugadores
{{autoCancelHoursBefore}} horas antes de su inicio.</p>
<p>El slot de la pista ha sido liberado.</p>
```
Variables contexto: name, email, formattedDate, maxParticipants, autoCancelHoursBefore
Notas: formattedDate = new Date(match.start_time).toLocaleString('es-ES'). maxParticipants = match.max_participants. autoCancelHoursBefore = match.auto_cancel_hours_before.

## 7. account.approved (adminController.js L53)
Asunto: `¡Tu cuenta en Padel@Home ha sido aprobada!`
HTML:
```
<h3>¡Hola, {{name}}!</h3><p>Tu cuenta ha sido aprobada. ¡Ya puedes iniciar sesión!</p>
```
Variables contexto: name, email

## 8. account.welcome (adminController.js L94)
Asunto: `¡Bienvenido a Padel@Home! Establece tu contraseña`
HTML:
```
<h3>¡Hola, {{name}}!</h3><p>Un administrador te ha creado una cuenta en Padel@Home.</p><p>Por favor, haz clic en el siguiente enlace para establecer tu contraseña. El enlace es válido por 24 horas.</p><a href="{{setPasswordUrl}}">Establecer mi contraseña</a>
```
Variables contexto: name, email, setPasswordUrl

## 9. password.reset (adminController.js L127-131)
Asunto: `Restablecimiento de Contraseña para Padel@Home`
HTML:
```
<h3>¡Hola, {{name}}!</h3><p>Se ha solicitado un restablecimiento de contraseña para tu cuenta de Padel@Home.</p><p>Por favor, haz clic en el siguiente enlace para establecer una nueva contraseña. El enlace es válido por 24 horas.</p><a href="{{setPasswordUrl}}">Establecer nueva contraseña</a><p>Si no solicitaste este cambio, por favor ignora este correo.</p>
```
Variables contexto: name, email, setPasswordUrl

## 10. auth.password-reset (authController.js L95-99)
Asunto: `Restablece tu contraseña de Padel@Home`
HTML:
```
<h3>Hola, {{name}}</h3><p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva:</p><a href="{{resetUrl}}">Restablecer Contraseña</a><p>Este enlace expirará en 30 minutos.</p>
```
Variables contexto: name, email, resetUrl
