import { Component, ViewChild } from '@angular/core';
import { NavParams, Slides, Loading, LoadingController, NavController } from 'ionic-angular';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { NfcProvider } from '../../providers/nfc';
import { HomePage } from '../home/home';
import { RepetitionPage } from '../repetition/repetition';
import 'rxjs/add/operator/first';
import { Observable } from 'rxjs/Observable';
import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/take';
import * as _ from "lodash";
import { BLE } from '@ionic-native/ble';
import { MachinesProvider } from '../../providers/machines';
@Component({
    selector: 'page-recommendation',
    templateUrl: 'recommendation.html',
})
export class RecommendationPage {
    private exercice;
    private exoID;
    private tagSubscribe;
    @ViewChild(Slides) slides: Slides;
    public countDown;
    private machine;
    private serie;
    private readPooling;
    private firstRepetion;
    private weightColor = { R: 0, G: 0, B: 0 };
    public serieLoaded: boolean = false;
    public weight;
    private weightSelected;
    public repetition;
    bilanButton = false;
    private imgSrc: string = "./assets/imgs/";
    public imgModelFront;
    public imgModelBack;
    private grpMuscu_front = [];
    private grpMuscu_back = [];
    public imgWidh = "80px";
    public imgHeight = "80px";
    private counter;
    private serieNumber;
    public videoUrl: SafeResourceUrl;
    private loadingVideo: Loading;
    public playClicked: boolean = false;
    private recupTime_sec;
    public gridSettings = [];
    private settings = [];
    private settingsUrl = "https://api.connectplus.fr/GCenterWCFOverHttps/getFichier/";
    private timeRest: boolean = true;
    public exerciceName: string;
    public imgGroupMuscu: any = {};

    constructor(
        public navParams: NavParams,
        private domSanitizer: DomSanitizer,
        public loadingCtrl: LoadingController,
        private navCtrl: NavController,
        private machinesProvider: MachinesProvider,
        private nfcService: NfcProvider,
        private ble: BLE
    ) {
        this.timeRest = this.navParams.get("timeRest");
        this.exercice = this.navParams.get("exercice");
        this.machine = this.navParams.get("machine");
        this.nfcService.canDisconnect = true;
    }

    ionViewDidLoad() {
        console.log('ionViewDidLoad RecommendationPage');

        if (this.serieNumber > 1)
            this.bilanButton = true;

        if (this.exercice)
            this.exoID = this.exercice.Mac_L_ExoUsag_Id;
        else
            this.exoID = this.machine.Modele.ExoUsage_Liste[0].Mac_L_ExoUsag_Id;
        let loadingGetSerie = this.loadingCtrl.create(
            {
                spinner: 'crescent',
                cssClass: 'loaderCustomCss',
            }
        );
        loadingGetSerie.present();
        this.machinesProvider.getSerie(this.nfcService.bleId, this.exoID)
            .subscribe(
                (serie) => {
                    this.serie = serie;
                },
                error => {
                    console.log("error_getSerie", error);
                },
                () => {
                    loadingGetSerie.dismiss();
                    if (this.serie.Adherent.Sex_Id == 1)
                        this.imgSrc = this.imgSrc + 'men/';
                    if (this.serie.Adherent.Sex_Id == 2)
                        this.imgSrc = this.imgSrc + 'women/';
                    this.imgModelFront = this.imgSrc + 'front.png';
                    this.imgModelBack = this.imgSrc + 'back.png';
                    _.map(this.serie.GrpMuscu_Liste, (value) => {
                        if (value.FrontBack === "Front") {
                            let imgMuscle = this.imgSrc + value.ImageFront;
                            this.grpMuscu_front.push(imgMuscle)
                        }
                        else {
                            let imgMuscle = this.imgSrc + value.ImageBack;
                            this.grpMuscu_back.push(imgMuscle);
                        }
                        return value
                    });
                    let firstGrpMuscu: any = this.serie.GrpMuscu_Liste[0];
                    this.imgGroupMuscu = {
                        isFront: firstGrpMuscu.FrontBack == 'Front',
                        img: this.imgSrc + firstGrpMuscu['Image' + firstGrpMuscu.FrontBack]
                    };
                    this.exerciceName = this.serie.Exer_Libelle;
                    this.repetition = this.serie.Adh_ExerciceConseil.NbRep;
                    this.weight = this.serie.Adh_ExerciceConseil.IntensitePossible_kg;
                    this.serieNumber = this.serie.NumSerie;
                    this.recupTime_sec = this.serie.Adh_ExerciceConseil.Recup_sec;
                    this.videoUrl = this.domSanitizer.bypassSecurityTrustResourceUrl(this.serie.LienVideo);
                    _.map(this.serie.ReglageConseil_Liste, (value) => {
                        this.settings.push(["url(" + this.settingsUrl + value.FichierImage + ")", value.Conseil])
                        return value
                    });
                    this.gridSettings = _.chunk(this.settings, 2);
                    this.changeTitle();
                    if (this.settings.length == 1) {
                        this.imgWidh = "150px";
                        this.imgHeight = "150px";
                    }
                    this.serieLoaded = true;
                    this.counter = this.recupTime_sec;
                    this.startTimer();
                    this.tagSubscribe = this.nfcService.getTagStatus().first(status => (status == "tag_disconnected")).subscribe(tagStatus => {
                        if (this.serieNumber > 1)
                            this.bilanButton = true
                        if (tagStatus === "tag_disconnected")
                            this.navCtrl.setRoot(HomePage, { bilanButton: this.bilanButton })
                    })
                }
            );

        console.log("this.nfcService.bleId", this.nfcService.bleId);

        this.readWeight();
        this.ble.startNotification(this.nfcService.bleId, 'f000da7a-0451-4000-b000-000000000000', 'f000beef-0451-4000-b000-000000000000')
            .subscribe((data) => {
                this.firstRepetion = (Array.prototype.slice.call(new Uint8Array(data)));
                if (this.firstRepetion[2] == 32 && this.navCtrl.getActive().name == "RecommendationPage") {
                    this.ble.stopNotification(this.nfcService.bleId, 'f000da7a-0451-4000-b000-000000000000', 'f000beef-0451-4000-b000-000000000000')
                        .then(() =>
                            this.navCtrl.setRoot(RepetitionPage, {
                                firstRepetion: this.firstRepetion,
                                weightSelected: this.weightSelected,
                                serie: this.serie,
                                exercice: this.exercice,
                                machine: this.machine
                            })
                        )
                }
            },
                (error) => {
                    console.log("error_bleRep", error);
                }
            );

    }
    ionViewWillUnload() {
        clearInterval(this.readPooling);
        if (this.tagSubscribe)
            this.tagSubscribe.unsubscribe();
        console.log("ionViewWillUnload RecommendationPage");
    }

    handleIFrameLoadEvent(): void {
        this.loadingVideo.dismiss();
    }

    slideChanged() {
        this.changeTitle();
    };

    changeTitle(): void {
        if (!this.slides.getActiveIndex() && this.timeRest)
            this.exerciceName = "REPOS"
        else
            this.exerciceName = this.serie.Exer_Libelle
    };
    playVideo() {
        this.playClicked = true;
        this.loadingVideo = this.loadingCtrl.create({
            spinner: 'crescent',
            cssClass: 'loaderCustomCss',
        })
        this.loadingVideo.present();
    };
    closeVideo() {
        this.playClicked = false;
    }
    startTimer() {
        this.countDown = Observable.timer(0, 1000)
            .takeWhile(() => this.counter != 0)
            .map(() => --this.counter)
    };
    /* addWeight(event) {
         console.log("weight", event)
         // this.weightSelected=this.weightSelected+event
     };*/

    readWeight() {
        this.readPooling = setInterval(() => {
            this.ble.isConnected(this.nfcService.bleId).then(() => {
                this.ble.read(this.nfcService.bleId, "f000da7a-0451-4000-b000-000000000000", "f000bfff-0451-4000-b000-000000000000")
                    .then((data) => {
                        let color = Array.prototype.slice.call(new Uint8Array(data));
                        let colorSelect = _.chunk(color, 3);
                        if (colorSelect[3] == 1)
                            this.weightColor = {
                                R: colorSelect[0][0],
                                G: colorSelect[0][1],
                                B: colorSelect[0][2]
                            }
                        if (colorSelect[3] == 2)
                            this.weightColor = {
                                R: colorSelect[1][0],
                                G: colorSelect[1][1],
                                B: colorSelect[1][2]
                            }
                        if (colorSelect[3] == 3)
                            this.weightColor = {
                                R: colorSelect[2][0],
                                G: colorSelect[2][1],
                                B: colorSelect[2][2]
                            }
                        if (colorSelect[3] == 0) {
                            let R = Math.round((colorSelect[0][0] + colorSelect[1][0] + colorSelect[2][0]) / 3);
                            let G = Math.round((colorSelect[0][1] + colorSelect[1][1] + colorSelect[2][1]) / 3);
                            let B = Math.round((colorSelect[0][2] + colorSelect[1][2] + colorSelect[2][2]) / 3);
                            this.weightColor = {
                                R: R,
                                G: G,
                                B: B
                            }
                        }
                        let etiquette = this.machine.Etiquette.EtiquetteDetail_Liste;
                        let weightOrdre = etiquette[0].Ordre;
                        let minDist = (etiquette[0].R - this.weightColor.R) * (etiquette[0].R - this.weightColor.R) + (etiquette[0].B - this.weightColor.B) * (etiquette[0].B - this.weightColor.B) + (etiquette[0].G - this.weightColor.G) * (etiquette[0].G - this.weightColor.G);
                        for (let index = 0; index < etiquette.length; index++) {
                            let dist = (etiquette[index].R - this.weightColor.R) * (etiquette[index].R - this.weightColor.R) + (etiquette[index].B - this.weightColor.B) * (etiquette[index].B - this.weightColor.B) + (etiquette[index].G - this.weightColor.G) * (etiquette[index].G - this.weightColor.G);
                            if (dist < minDist) {
                                minDist = dist;
                                weightOrdre = etiquette[index].Ordre;
                            }
                        };
                        let masseList = this.machine.Modele.Masse_Principal.MasseDetail_Liste;
                        this.weightSelected = _.find(masseList, { "Ordre": weightOrdre }).Masse_kg;

                    }, (error) => {
                        console.log('ble read error', error);
                    });

            }, () => console.log(" recomandation ble disconnected")
            )
        }, 2000)
    }
}

