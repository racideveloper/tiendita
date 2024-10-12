let db;
const request = indexedDB.open('DeudoresDB', 1);

request.onupgradeneeded = function(event) {
    db = event.target.result;

    const clientesStore = db.createObjectStore('clientes', { keyPath: 'id', autoIncrement: true });
    clientesStore.createIndex('nombre', 'nombre', { unique: true });

    const transaccionesStore = db.createObjectStore('transacciones', { keyPath: 'id', autoIncrement: true });
    transaccionesStore.createIndex('clienteId', 'clienteId');
};

request.onsuccess = function(event) {
    db = event.target.result;
    console.log('Base de datos abierta con éxito');
    mostrarClientes();
};

request.onerror = function(event) {
    console.log('Error al abrir la base de datos', event);
};


document.getElementById('clienteForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const nombre = document.getElementById('nombreCliente').value;

  const transaction = db.transaction(['clientes'], 'readwrite');
  const store = transaction.objectStore('clientes');
  const index = store.index('nombre');

  // Verificar si el cliente ya existe
  const request = index.get(nombre);

  request.onsuccess = function(event) {
    const clienteExistente = event.target.result;
    if (clienteExistente) {
      alert(`El cliente "${nombre}" ya está registrado.`);
    } else {
      const nuevoCliente = { nombre: nombre, totalDeuda: 0 };

      const addRequest = store.add(nuevoCliente);
      addRequest.onsuccess = function() {
        alert(`Cliente "${nombre}" agregado con éxito.`);
        document.getElementById('nombreCliente').value = '';  // Limpiar formulario
        mostrarClientes();  // Actualizar la lista de clientes
      };

      addRequest.onerror = function() {
        alert('Error al agregar el cliente.');
      };
    }
  };

  request.onerror = function() {
    alert('Error al verificar si el cliente ya existe.');
  };
});


function mostrarClientes() {
  const transaction = db.transaction(['clientes'], 'readonly');
  const store = transaction.objectStore('clientes');

  const clientesBody = document.getElementById('clientesBody');
  clientesBody.innerHTML = '';  // Limpiar tabla

  const request = store.openCursor();

  request.onsuccess = function(event) {
      const cursor = event.target.result;
      if (cursor) {
          const cliente = cursor.value;
          clientesBody.innerHTML += `
              <tr>
                  <td>${cliente.nombre}</td>
                  <td>${cliente.totalDeuda}</td>
                  <td>
                      <button onclick="mostrarDetalle(${cliente.id})">Ver Detalle</button>
                      <button onclick="eliminarCliente(${cliente.id}, '${cliente.nombre}')">Eliminar</button>
                  </td>
              </tr>
          `;
          cursor.continue();
      }
  };

  request.onerror = function(event) {
    console.log('Error al mostrar los clientes.', event);
    alert('Error al mostrar los clientes.');
  };
}


document.getElementById('productoForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const nombreCliente = document.getElementById('nombreClienteProducto').value;
  const producto = document.getElementById('producto').value;
  const precio = parseFloat(document.getElementById('precio').value);
  const fecha = new Date().toLocaleDateString();

  // Buscar el cliente por nombre
  const transaction = db.transaction(['clientes'], 'readwrite');
  const store = transaction.objectStore('clientes');
  const index = store.index('nombre');
  const request = index.get(nombreCliente);

  request.onsuccess = function(event) {
      const cliente = event.target.result;
      if (cliente) {
          // Registrar la transacción
          const transaccion = {
              clienteId: cliente.id,
              tipo: 'fiado',
              producto: producto,
              precio: precio,
              fecha: fecha
          };
          const transaccionesTransaction = db.transaction(['transacciones'], 'readwrite');
          const transaccionesStore = transaccionesTransaction.objectStore('transacciones');
          transaccionesStore.add(transaccion);

          // Actualizar deuda
          cliente.totalDeuda += precio;
          store.put(cliente);
          document.getElementById('nombreClienteProducto').value = '';
          document.getElementById('producto').value = '';
          document.getElementById('precio').value = '';
          mostrarClientes();
          alert(`Producto "${producto}" registrado para el cliente "${nombreCliente}" por ${precio} unidades.`);
      } else {
        alert('Cliente no encontrado. Registra primero al cliente.');
      }
  };
});


function mostrarDetalle(clienteId) {
  // Transacción para obtener las transacciones del cliente
  const transaction = db.transaction(['transacciones'], 'readonly');
  const store = transaction.objectStore('transacciones');
  const index = store.index('clienteId');
  const request = index.getAll(clienteId);

  request.onsuccess = function(event) {
      const transacciones = event.target.result;

      if (transacciones.length > 0) {
          let detalle = `Historial del Cliente (ID: ${clienteId}):\n\n`;

          // Variables para almacenar las transacciones por tipo
          let productosFiados = '';
          let abonosRealizados = '';

          transacciones.forEach((transaccion) => {
              if (transaccion.tipo === 'fiado') {
                  productosFiados += `Producto: ${transaccion.producto} - Precio: ${transaccion.precio} - Fecha: ${transaccion.fecha}\n`;
              } else if (transaccion.tipo === 'abono') {
                  abonosRealizados += `Abono: ${transaccion.monto} - Fecha: ${transaccion.fecha}\n`;
              }
          });

          // Construir el mensaje del historial
          if (productosFiados) {
            detalle += 'Productos Fiados:\n' + productosFiados;
        } else {
            detalle += 'No hay productos fiados registrados.\n';
        }

        if (abonosRealizados) {
            detalle += '\nAbonos Realizados:\n' + abonosRealizados;
        } else {
            detalle += '\nNo hay abonos registrados.\n';
        }

          alert(detalle);  // Mostramos el detalle de las transacciones con un alert
      } else {
          alert('No hay transacciones registradas para este cliente.');
      }
  };

  request.onerror = function(event) {
      alert('Error al obtener el detalle del cliente.');
  };
}


function llenarComboDeudores() {
  const transaction = db.transaction(['clientes'], 'readonly');
  const store = transaction.objectStore('clientes');
  const request = store.getAll();

  request.onsuccess = function(event) {
      const clientes = event.target.result;
      const clienteCombo = document.getElementById('clienteCombo');
      clienteCombo.innerHTML = '';  // Limpiar el combobox

      clientes.forEach(cliente => {
          if (cliente.totalDeuda > 0) {  // Solo agregar clientes con deuda
              const option = document.createElement('option');
              option.value = cliente.id;
              option.text = cliente.nombre;
              clienteCombo.appendChild(option);
          }
      });
  };

  request.onerror = function(event) {
      alert('Error al cargar los clientes deudores.');
  };
}

// Llenar el combobox al cargar la página
window.onload = function() {
  llenarComboDeudores();  
};



document.getElementById('abonoForm').addEventListener('submit', function(e) {
  e.preventDefault();

  const clienteId = parseInt(document.getElementById('clienteCombo').value);
  const montoAbono = parseFloat(document.getElementById('montoAbono').value);
  const fecha = new Date().toLocaleDateString();

  // Buscar el cliente por ID
  const transaction = db.transaction(['clientes'], 'readwrite');
  const store = transaction.objectStore('clientes');
  const request = store.get(clienteId);

  request.onsuccess = function(event) {
      const cliente = event.target.result;
      if (cliente) {
          // Validar que el monto del abono no sea mayor que la deuda
          if (montoAbono > cliente.totalDeuda) {
              alert('El monto del abono es mayor que la deuda actual.');
          } else {
              // Registrar el abono como una transacción
              const abono = {
                  clienteId: cliente.id,
                  tipo: 'abono',
                  monto: montoAbono,
                  fecha: fecha
              };
              const transaccionesTransaction = db.transaction(['transacciones'], 'readwrite');
              const transaccionesStore = transaccionesTransaction.objectStore('transacciones');
              transaccionesStore.add(abono);

              // Actualizar deuda del cliente
              cliente.totalDeuda -= montoAbono;
              store.put(cliente).onsuccess = function() {
                  mostrarClientes();  // Refrescar la tabla de clientes
                  llenarComboDeudores();  // Actualizar el combobox de deudores
                  alert(`Abono de ${montoAbono} unidades registrado para "${cliente.nombre}". Deuda restante: ${cliente.totalDeuda}`);
                  document.getElementById('montoAbono').value = '';  // Limpiar el campo del abono
              };
          }
      } else {
          alert('Cliente no encontrado.');
      }
  };

  request.onerror = function(event) {
      alert('Error al buscar el cliente.');
  };
});



function eliminarCliente(clienteId, clienteNombre) {
  if (confirm(`¿Estás seguro de que deseas eliminar al cliente "${clienteNombre}"? Esta acción es irreversible.`)) {
    // Primero eliminamos las transacciones asociadas
    const transaccionesTransaction = db.transaction(['transacciones'], 'readwrite');
    const transaccionesStore = transaccionesTransaction.objectStore('transacciones');
    const index = transaccionesStore.index('clienteId');
    const transaccionesRequest = index.getAll(clienteId);

    transaccionesRequest.onsuccess = function(event) {
      const transacciones = event.target.result;
      if (transacciones.length > 0) {
        transacciones.forEach(transaccion => {
          const deleteRequest = transaccionesStore.delete(transaccion.id);
          deleteRequest.onsuccess = function() {
            console.log(`Transacción con ID ${transaccion.id} eliminada.`);
          };
        });
      }
    };

    transaccionesRequest.onerror = function(event) {
      alert('Error al eliminar las transacciones del cliente.');
    };

    // Luego eliminamos al cliente
    const clientesTransaction = db.transaction(['clientes'], 'readwrite');
    const clientesStore = clientesTransaction.objectStore('clientes');
    const clienteDeleteRequest = clientesStore.delete(clienteId);

    clienteDeleteRequest.onsuccess = function(event) {
      alert(`Cliente "${clienteNombre}" eliminado exitosamente.`);
      mostrarClientes();  // Refrescar la lista de clientes en la interfaz
      llenarComboDeudores();  // Actualizar el combobox de deudores
    };

    clienteDeleteRequest.onerror = function(event) {
      alert('Error al eliminar el cliente.');
    };
  }
}