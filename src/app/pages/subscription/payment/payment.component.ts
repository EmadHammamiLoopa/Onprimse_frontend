import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NativeStorage } from '@ionic-native/native-storage/ngx';
import { Stripe, StripeCardTokenParams } from '@ionic-native/stripe/ngx';
import { ConfirmCardPaymentData } from '@stripe/stripe-js';
import { StripeService } from 'ngx-stripe';
// declare var Stripe;
import constants from 'src/app/helpers/constants';
import { User } from 'src/app/models/User';
import { SubscriptionService } from 'src/app/services/subscription.service';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss'],
})
export class PaymentComponent implements OnInit {

  // testCrad "4242424242424242"
  cardNumber;
  cardMonth;
  cardYear;
  cardCVV;
  cardUserName;

  months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  years = [];

  price = '0';
  duration: string;
  subscriptionId: string;

  pageLoading = false;
  success = false;

  clientSecret: string;

  constructor(private stripe: Stripe, private toastService: ToastService, private route: ActivatedRoute, private subscriptionService:
              SubscriptionService, private nativeStorage: NativeStorage, private stripeService: StripeService) { }


  ionViewWillEnter(){
    this.getQueryParams();
    this.initYearsValues();
    this.stripe.setPublishableKey(constants.STRIPE_PUBLIC_KEY);
    this.success = false;
  }

  ngOnInit() {
  }

  initYearsValues(){
    for(let i = new Date().getFullYear(); i < new Date().getFullYear() + 20; i++) this.years.push(i);
  }

  getQueryParams(){
    this.pageLoading = true;
    this.route.queryParamMap.subscribe(
      query => {
        this.price = query.get('price')
        this.duration = query.get('duration')
        this.subscriptionId = query.get('subscription_id')
        this.getClientSecret();
      }
    )
  }

  getClientSecret(){
    this.subscriptionService.getClientSecret(this.subscriptionId, {duration: this.duration})
    .then(
      (resp: any) => {
        this.clientSecret = resp.data.client_secret
        this.pageLoading = false;
      },
      err => {
        this.toastService.presentStdToastr(err)
        this.pageLoading = false;
      }
    )
  }

  createCardPayment(){
    this.pageLoading = true;
    const card: StripeCardTokenParams = {
      number: this.cardNumber,
      expMonth: parseInt(this.cardMonth),
      expYear: parseInt(this.cardYear),
      cvc: this.cardCVV,
      name: this.cardUserName
    };

    return this.stripe.createCardToken(card)
  }

  confirmCardPayment(token){
    return this.stripeService.confirmCardPayment(this.clientSecret, {
      payment_method: {
        card: {token: token.id},
      }
    })
  }

  subscribe(){
    this.subscriptionService.subscribe(this.subscriptionId, {
      duration: this.duration
    })
    .then(
      (resp: any) => {
        this.pageLoading = false;
        this.toastService.presentStdToastr(resp.message);
        const user = new User().initialize(resp.data)
        this.nativeStorage.setItem('user', user.toObject());
        this.success = true;
      },
      err => {
        this.pageLoading = false;
        this.toastService.presentStdToastr(err)
      }
    )
  }

  payAndSubscribe(){
    this.createCardPayment()
    .then(
      res => {
        this.confirmCardPayment(res).subscribe(
          resp => {
            this.subscribe();
          },
          err => {
            this.pageLoading = false;
            this.toastService.presentStdToastr(err)
          }
        )
      }, err => {
        this.pageLoading = false;
        this.toastService.presentStdToastr(err)
      }
    )
  }
}
