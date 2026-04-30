#include <DHT.h>

// --- CONFIGURACIÓN DHT11 ---
#define DHTPIN 27       // Usando el G27 recomendado
#define DHTTYPE DHT11  
DHT dht(DHTPIN, DHTTYPE);

// --- CONFIGURACIÓN SENSOR CAPACITIVO ---
const int pinSensorTierra = 32; 
const int valorSeco = 2900;     
const int valorHumedo = 1500;   

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void loop() {
  delay(2000);

  float humedadAmbiente = dht.readHumidity();
  float temperaturaAmbiente = dht.readTemperature();

  int valorCrudoTierra = analogRead(pinSensorTierra);
  int porcentajeTierra = map(valorCrudoTierra, valorSeco, valorHumedo, 0, 100);
  porcentajeTierra = constrain(porcentajeTierra, 0, 100);

  // --- FORMATO ESTRICTO PARA EL SERIAL PLOTTER ---
  
  // 1. Verificamos que el DHT11 no tenga error para no graficar "nan" (Not a Number)
  if (!isnan(temperaturaAmbiente) && !isnan(humedadAmbiente)) {
    Serial.print("Temp_Ambiente:");
    Serial.print(temperaturaAmbiente);
    Serial.print(","); // La coma separa las variables
    
    Serial.print("Humedad_Ambiente:");
    Serial.print(humedadAmbiente);
    Serial.print(","); 
  }

  // 2. Imprimimos la última variable con println() para dar el salto de línea
  Serial.print("Humedad_Tierra:");
  Serial.println(porcentajeTierra);
}