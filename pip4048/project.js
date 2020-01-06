'use strict';

var mpi = require("solar-sis");

var mqtt = require('mqtt')
var https = require('https');
var client  = mqtt.connect('mqtt://10.0.0.20:1883')
var emonApiKey = 'huahuahuahua';
var emonCmsUrl = 'https://emoncms.home.mvalov.me/input/post?node=solar-sis&fulljson=JSON_DATA&apikey=' + emonApiKey;

function MyMpiCallbacks () {
  var fr = 0;
  var fs = 0;
  var ft = 0;

  this.power_status = function (qc, data, arr, json, influx) {
    //console.log("mpi_power: influx : " + influx);
    //mpi.SendDataToInflux('mpi_power ' + influx);

    client.publish('solar/mpi', (Number(arr[0]) + Number(arr[1])).toString());
  }

  this.power_status_mnv = function (qc, data, arr, json, influx) {
    var solar_w = Number(json['pv_input_current_for_battery'])*Number(json['battery_voltage']);//Number(json['pv_input_voltage_1']);
    //var bat_w = Number(json['battery_charging_current'])*Number(json['battery_voltage_from_scc'])-Number(json['battery_discharge_current'])*Number(json['battery_voltage']);
    var output_w = Number(json['ac_output_active_power']);
    //console.log("solar: " + solar_w);
    //console.log("charge: " +  Number(json['battery_charging_current'])*Number(json['battery_voltage_from_scc']));
    //console.log("discharge: " + Number(json['battery_discharge_current'])*Number(json['battery_voltage']));
    //console.log("output: " + output_w);
    var charge = Number(json['battery_charging_current'])*Number(json['battery_voltage_from_scc']);
    var discharge = Number(json['battery_discharge_current'])*Number(json['battery_voltage']);
    var ac_w = output_w - solar_w - Number(json['battery_discharge_current'])*Number(json['battery_voltage_from_scc']) - Number(json['battery_charging_current'])*Number(json['battery_voltage']);
    
    if(solar_w >  charge)
    {
      ac_w = 0;
    } else if (discharge < output_w)
    {
      ac_w = output_w - discharge - solar_w;
    }
    console.log("AC_W: " + ac_w);
    //console.log(qc);
    //console.log(data);
    //console.log(arr);
    //console.log(json);
    client.publish('solar/solar', solar_w.toString());
    //client.publish('solar/bat', bat_w.toString());
    client.publish('solar/ac', ac_w.toString());
    client.publish('solar/output', output_w.toString());

    var tempObj = {
      solar_w: solar_w,
      output_w: output_w,
      charge: charge,
      discharge: discharge
    }

    https.get(emonCmsUrl.replace('JSON_DATA', JSON.stringify(tempObj)), function (resp) {
      
    }).on("error", function (err) {
      console.log('EmonCMS error: ' + err);
    });
  }

  this.feeding_grid_power_calibration = function (qc, data, arr) {
    //console.log("feeding_grid_power_calibration: " + data);
    //console.log("feeding_grid_power_calibration: arr: " + arr);

    fr = arr[3];
    fs = arr[5];
    ft = arr[7];

    console.log("fr: " + fr + " fs: " + fs + " ft: " + ft);

    if (data) {
      mpi.SendDataToInflux('mpi_calibration fas_r=' + fr + ',fas_s=' + fs + ',fas_t=' + ft);
    }
  }

  this.before_f1 = function (values) {
    console.log("fr: " + fr + " fs: " + fs + " ft: " + ft);
  
    var watt = values.w;
    var fase = values.f;
  
    if (values.a == 1) {
      if (fase == 'R') { watt = Number(fr) + Number(watt);}
      if (fase == 'S') { watt = Number(fs) + Number(watt);}
      if (fase == 'T') { watt = Number(ft) + Number(watt);}
    }
  
    console.log('watt: ' + watt + ' fase:' + fase);
  
    return ({"fase" : fase + "ADJ1", "watt" : watt});
  }
  
  this.callback_f1 = function (qc, data, arr) {
    myMpi.SendQuickCommand("feeding_grid_power_calibration");
  }
}

var myMpi = new mpi.mpi();
var callbacks = new MyMpiCallbacks();
myMpi.init(callbacks);
