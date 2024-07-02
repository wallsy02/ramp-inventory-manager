// Your client ID from the downloaded JSON file
const CLIENT_ID = '1048065093155-uvnqnlp4114hrodu0roerntmo9ptggqf.apps.googleusercontent.com';
// Your API key from the Google Cloud Console
const API_KEY = 'AIzaSyDrWIsoMoONad8DuVgD4Hrvrsb7Eu1eny0';
// Your Google Sheet ID
const SPREADSHEET_ID = '1XrZZe0drtW4ecdLfTjrLMhLhX6Ehyql9K-CzDMNcHEQ';

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ["https://sheets.googleapis.com/$discovery/rest?version=v4", "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];

// Authorization scopes required by the API
const SCOPES = "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";

let installationAddress = "Unknown Address";

document.addEventListener('DOMContentLoaded', function() {
    alert('DOMContentLoaded');
    const scanButton = document.getElementById('scanButton');
    const clearButton = document.getElementById('clearButton');
    const createInvoiceButton = document.getElementById('createInvoiceButton');
    const undoInvoiceButton = document.getElementById('undoInvoiceButton');
    const resultDiv = document.getElementById('result');
    const scannedListDiv = document.getElementById('scanned-list');
    const scannedCountDiv = document.getElementById('scanned-count');
    let html5QrCode;
    let scannedItems = [];

    scanButton.addEventListener('click', function() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => {
                scanButton.textContent = 'Start Scanning';
                alert('Stopped scanning');
            }).catch(err => {
                alert('Failed to stop scanning: ' + err);
            });
        } else {
            html5QrCode = new Html5Qrcode("reader");
            html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                onScanSuccess,
                onScanFailure
            ).then(() => {
                scanButton.textContent = 'Stop Scanning';
                alert('Started scanning');
            }).catch(err => {
                alert('Failed to start scanning: ' + err);
                resultDiv.textContent = 'Failed to access camera. Please ensure camera permissions are granted.';
            });
        }
    });

    clearButton.addEventListener('click', function() {
        scannedItems = [];
        updateScannedList();
        alert('List cleared');
    });

    createInvoiceButton.addEventListener('click', function() {
        alert('Create Invoice Button Clicked');
        createInvoice();
    });

    undoInvoiceButton.addEventListener('click', function() {
        alert('Undo Invoice Button Clicked');
        undoInvoice();
    });

    function onScanSuccess(decodedText, decodedResult) {
        alert('Scan Success: ' + decodedText);
        processScannedData(decodedText);
    }

    function onScanFailure(error) {
        alert('Scan Failure: ' + JSON.stringify(error));
        console.warn('Scan Failure:', error);
    }

    function processScannedData(data) {
        const itemId = data;
        const [type, id] = itemId.split('-');
        const length = type.includes('LD') ? '5' : type.substring(2); // Extract length from type for ramps

        if (!scannedItems.some(item => item.id === itemId)) {
            const scannedItem = {
                id: itemId,
                type: type,
                length: length,
                timestamp: new Date().toLocaleString()
            };

            scannedItems.unshift(scannedItem);
            updateScannedList();
            updateGoogleSheet(scannedItem);
        } else {
            alert('Item already scanned: ' + itemId);
        }

        resultDiv.textContent = `Last scanned: ${itemId}`;
    }

    function updateScannedList() {
        scannedListDiv.innerHTML = '<h3>Scanned Items</h3>';
        if (scannedItems.length === 0) {
            scannedListDiv.innerHTML += '<p>No items scanned yet.</p>';
        } else {
            const ul = document.createElement('ul');
            scannedItems.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.id} - ${item.length}ft - ${item.timestamp}`;
                ul.appendChild(li);
            });
            scannedListDiv.appendChild(ul);
        }
        scannedCountDiv.textContent = `Total scanned items: ${scannedItems.length}`;
    }

    function updateGoogleSheet(item) {
        const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Inventory!A:E:append?valueInputOption=USER_ENTERED`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                values: [[item.id, item.type, item.length, 'Installed', '']]
            })
        }).then(response => response.json())
        .then(data => {
            alert('Google Sheet updated: ' + JSON.stringify(data));
        }).catch(error => {
            alert('Error updating Google Sheet: ' + JSON.stringify(error));
        });
    }

    function createInvoice() {
        alert('createInvoice called');
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(function(position) {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${API_KEY}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.results && data.results.length > 0) {
                            installationAddress = data.results[0].formatted_address;
                        } else {
                            installationAddress = "Address not found";
                        }
                        finalizeInvoiceCreation();
                    })
                    .catch(error => {
                        alert('Error fetching address: ' + error);
                        installationAddress = "Error fetching address";
                        finalizeInvoiceCreation();
                    });
            }, function(error) {
                alert('Error getting location: ' + error);
                installationAddress = "Error getting location";
                finalizeInvoiceCreation();
            });
        } else {
            alert('Geolocation not available');
            installationAddress = "Geolocation not available";
            finalizeInvoiceCreation();
        }
    }

    function finalizeInvoiceCreation() {
        alert('finalizeInvoiceCreation called');
        const componentsUsed = scannedItems.map(item => item.id).join(', ');
        const totalLength = scannedItems.reduce((sum, item) => sum + parseFloat(item.length), 0);
        const totalInstallationCost = calculateTotalInstallationCost(scannedItems);
        const totalMonthlyRate = calculateTotalMonthlyRate(scannedItems);
        const invoiceId = `INV-${Date.now()}`;

        const invoiceData = [
            new Date().toLocaleString(),
            invoiceId,
            installationAddress, // Use the fetched address
            componentsUsed,
            totalLength,
            totalInstallationCost,
            totalMonthlyRate,
            '' // Placeholder for the invoice URL
        ];

        generateInvoicePDF(invoiceData, function(pdfBlob) {
            uploadToDrive(pdfBlob, invoiceId, function(invoiceUrl) {
                invoiceData[7] = invoiceUrl;
                appendInvoiceToSheet(invoiceData);
            });
        });
    }

    function generateInvoicePDF(invoiceData, callback) {
        alert('generateInvoicePDF called');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.text('Invoice', 20, 20);
        doc.text(`Date: ${invoiceData[0]}`, 20, 30);
        doc.text(`Invoice ID: ${invoiceData[1]}`, 20, 40);
        doc.text(`Address: ${invoiceData[2]}`, 20, 50);
        doc.text(`Components Used: ${invoiceData[3]}`, 20, 60);
        doc.text(`Total Length: ${invoiceData[4]} ft`, 20, 70);
        doc.text(`Installation Cost: $${invoiceData[5]}`, 20, 80);
        doc.text(`Monthly Rate: $${invoiceData[6]}`, 20, 90);

        const pdfBlob = doc.output('blob');
        callback(pdfBlob);
    }

    function uploadToDrive(pdfBlob, invoiceId, callback) {
        alert('uploadToDrive called');
        const fileMetadata = {
            'name': `Invoice-${invoiceId}.pdf`,
            'mimeType': 'application/pdf'
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', pdfBlob);

        const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;

        fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: form
        }).then(response => response.json())
          .then(data => {
              alert('File uploaded to Drive');
              const fileId = data.id;
              fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
                  method: 'POST',
                  headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                      'role': 'reader',
                      'type': 'anyone'
                  })
              }).then(() => {
                  const invoiceUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
                  callback(invoiceUrl);
              });
          }).catch(error => {
              alert('Error uploading to Drive: ' + error);
          });
    }

    function appendInvoiceToSheet(invoiceData) {
        alert('appendInvoiceToSheet called');
        const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Installations!A:H:append?valueInputOption=USER_ENTERED`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                values: [invoiceData]
            })
        }).then(response => response.json())
        .then(data => {
            alert('Invoice created: ' + JSON.stringify(data));
            markComponentsAsUnavailable();
        }).catch(error => {
            alert('Error creating invoice: ' + JSON.stringify(error));
        });
    }

    function undoInvoice() {
        alert('undoInvoice called');
        const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
        // Fetch the last invoice data
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Installations!A:H`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }).then(response => response.json())
        .then(data => {
            const rows = data.values;
            if (rows.length > 0) {
                const lastInvoice = rows[rows.length - 1];
                const componentsUsed = lastInvoice[3].split(', ');
                markComponentsAsAvailable(componentsUsed);

                // Delete the last invoice row
                gapi.client.sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: 'Installations', // Ensure this is the correct sheet ID
                                    dimension: 'ROWS',
                                    startIndex: rows.length - 1,
                                    endIndex: rows.length
                                }
                            }
                        }]
                    }
                }).then((response) => {
                    alert('Invoice undone');
                }, (reason) => {
                    alert('Error undoing invoice: ' + JSON.stringify(reason));
                });
            } else {
                alert('No invoices to undo.');
            }
        }).catch(error => {
            alert('Error fetching invoices: ' + JSON.stringify(error));
        });
    }

    function markComponentsAsUnavailable() {
        scannedItems.forEach(item => {
            const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Inventory!A${item.rowNumber}:E${item.rowNumber}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    values: [[item.id, item.type, item.length, 'Unavailable', '']]
                })
            }).then(response => response.json())
            .then(data => {
                alert('Component marked as unavailable');
            }).catch(error => {
                alert('Error marking component as unavailable: ' + JSON.stringify(error));
            });
        });
    }

    function markComponentsAsAvailable(components) {
        components.forEach(componentId => {
            const item = scannedItems.find(item => item.id === componentId);
            if (item) {
                const token = gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
                fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Inventory!A${item.rowNumber}:E${item.rowNumber}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        values: [[item.id, item.type, item.length, 'Available', '']]
                    })
                }).then(response => response.json())
                .then(data => {
                    alert('Component marked as available');
                }).catch(error => {
                    alert('Error marking component as available: ' + JSON.stringify(error));
                });
            }
        });
    }

    function calculateTotalInstallationCost(items) {
        // Logic to calculate total installation cost
        return items.reduce((sum, item) => sum + parseFloat(item.type === 'LD' ? 100 : item.type.substring(2) * 10), 0); // Example calculation
    }

    function calculateTotalMonthlyRate(items) {
        // Logic to calculate total monthly rate
        return items.reduce((sum, item) => sum + parseFloat(item.type === 'LD' ? 20 : item.type.substring(2) * 2), 0); // Example calculation
    }

    // Initial update of the scanned list
    updateScannedList();
});

function initClient() {
    gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES
    }).then(function () {
        alert('Google API client initialized');
        // Listen for sign-in state changes.
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        // Handle the initial sign-in state.
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    }, function(error) {
        alert('Error initializing Google Sheets API: ' + JSON.stringify(error, null, 2));
    });
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        alert('User is signed in to Google');
    } else {
        alert('User is not signed in to Google');
    }
}

function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}
