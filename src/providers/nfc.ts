import { Injectable } from '@angular/core';
import { NFC } from '@ionic-native/nfc';
import { LoadingController } from 'ionic-angular';
import { Observable, BehaviorSubject, Subscription } from 'rxjs';
import { BLE } from '@ionic-native/ble';
import { Gyroscope, GyroscopeOrientation, GyroscopeOptions } from '@ionic-native/gyroscope';
import { Platform } from 'ionic-angular';
import 'rxjs/add/operator/retry';

@Injectable()
export class NfcProvider {

  public bleId: string;
  private tagStatus: BehaviorSubject<any> = new BehaviorSubject('');
  private accSubscribe: Subscription;
  private sub: Subscription
  public canDisconnect: boolean = true;

  constructor(private nfc: NFC,
    private ble: BLE,
    private loadingCtrl: LoadingController,
    private platform: Platform,
    private gyroscope: Gyroscope
  ) {
    console.log('Hello NfcProvider Provider');
  }


  public nfcInit(): Promise<string> {
    console.log('nfcInit');
    return new Promise((resolve, reject) => {
      if (this.platform.is("ios")) {
        this.nfc.beginSession().subscribe(() => {
          this.nfc.addNdefListener((data) => {
            console.log("IOS: ", data) // You will not see this, at this point the app will crash
          })
        });
      }

      this.ble.isConnected(this.bleId)
        .then(() => {
          console.log(' ble isConnected true', this.bleId);
          setTimeout(() => {
            this.ble.disconnect(this.bleId).then(() => {
              console.log('disc ok');
              this.nfcListener().then(() => { resolve(this.bleId) })
            }, error => {
              console.log('disco error', error);
            });
          }, 500)
        }, () => { this.nfcListener().then(() => { resolve(this.bleId) }) });
    });
  }

  /*private startWatch() {
    let options: GyroscopeOptions = {
      frequency: 20
    };
    let nb: number = 0;
    this.accSubscribe = this.gyroscope.watch(options)
      .subscribe((orientation: GyroscopeOrientation) => {
        if (!this.canDisconnect)
          return;
        if (Math.abs(orientation.x) > 0.2 || Math.abs(orientation.y) > 0.2 || Math.abs(orientation.z) > 0.2) {
          if (++nb > 50) {
            console.log('vertically moved canDisconnect', this.canDisconnect);
            this.accSubscribe.unsubscribe();
            this.tagStatus.next('tag_disconnected');

            // this.bleService.disconnect().then(() => { console.log("bleService disconnected after acceleration") });
          }
        } else {
          nb = 0;
        }
      });
  }*/
  private startWatch() {
    let isconnected = setInterval(() => {
      this.nfc.tagIsConnected().then(
        (status) => console.log("tagIsConnected scc: ", status),
        (error) => {
          console.log("tagIsConnected err : ", error);
          if (error == "tag_deconnected") {
            this.tagStatus.next('tag_disconnected');
            clearInterval(isconnected)
          }
        }
      );
    },500)

  }

  getTagStatus(): Observable<any> {
    return this.tagStatus.asObservable();
  }


  private nfcListener(): Promise<string> {
    return new Promise((resolve, reject) => {

      this.sub = this.nfc.addNdefListener((e) => {
        console.log('successfully attached ndef listener', e);
      }, (err) => {
        console.log('error attaching ndef listener', err);
      })
        .subscribe(event => {
          console.log("nfcListener in : ", event);
          let bleIdBytes = event.tag.ndefMessage[0]["payload"];
          this.bleId = this.nfc.bytesToString(bleIdBytes.slice(3));
          console.log('tag read success', this.bleId);
          let loadingNfcConnect = this.loadingCtrl.create(
            {
              spinner: 'crescent',
              cssClass: 'loaderCustomCss',
            }
          );
          loadingNfcConnect.present();
          setTimeout(() => {
            this.ble.startScan([])
              .subscribe(device => {
                console.log('ble found', device);
                if (device.id == this.bleId) {
                  this.ble.stopScan().then(() => {
                    console.log('scan stopped');
                    setTimeout(() => {
                      this.ble.connect(this.bleId).retry(5).subscribe(deviceData => {
                        console.log('ble connected', deviceData);
                        loadingNfcConnect.dismiss();
                        this.startWatch();
                        this.tagStatus.next('tag_connected');
                        resolve(this.bleId);
                      }, error => {
                        console.log('ble connect error', error);
                      });
                    }, 500);
                  });
                }
              }, error => {
                console.log('startScan error', error);
              });
          }, 500);
          this.sub.unsubscribe();
        },
          error => {
            console.log('event error', error);
          });
    })
  }
}