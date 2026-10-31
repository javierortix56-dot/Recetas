rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo la familia, con correo de Google verificado. Reemplazar CORREO_2 por el real.
    function esFamilia() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in ['javierortix56@gmail.com', 'CORREO_2'];
    }

    match /users/usuario-local/{document=**} {
      allow read, write: if esFamilia();
    }

    // Todo lo demás, cerrado
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
