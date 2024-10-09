import { IonInfiniteScroll } from '@ionic/angular';
import { Service } from './../../../../models/Service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from './../../../../services/toast.service';
import { ServiceService } from './../../../../services/service.service';
import { Component, OnInit, ViewChild } from '@angular/core';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class ListComponent implements OnInit {
  @ViewChild('infinitScroll') infinitScroll: IonInfiniteScroll;

  pageLoading = false;
  services: Service[];
  page: number;
  searchQuery: string;
  type: string;

  constructor(private serviceService: ServiceService, private toastService: ToastService,private router: Router,
              private route: ActivatedRoute) { }

  ngOnInit() {}

  ionViewWillEnter(){
    this.pageLoading = true;
    this.searchQuery = "";
    this.page = 0;
    this.getPageType();
  }


  showServiceForm(){
    this.pageLoading = true;
    this.serviceService.getStorePermession()
    .then(
      (resp: any) => {
        if(resp.data.date){
          this.router.navigate(['/tabs/subscription'], {
            queryParams: {
              lastDate: resp.data.date
            }
          });
        }else this.router.navigateByUrl('/tabs/small-business/services/form')
        this.pageLoading = false;
      },
      err => {
        console.log(err);
        this.pageLoading = false;
      }
    )
  }

  getPageType(){
    this.route.paramMap
    .subscribe(
      param => {
        this.type = param.get('type');
        this.page = 0;
        this.getServices(null);
      }
    )
  }

  search(val: string){
    this.page = 0;
    this.searchQuery = val;
    this.getServices(null);
  }

  handleResponse(event, refresh, resp: any){
    if(!event || refresh) this.services = [];

    if(refresh) this.infinitScroll.disabled = false

    if(event){
      event.target.complete();
      if(!resp.data.more && !refresh) event.target.disabled = true;
    }

    resp.data.services.forEach(srv => {
      const service = new Service(srv);
      this.services.push(service);
    })

    this.pageLoading = false;
  }

  handleError(err){
    console.log(err);
    this.pageLoading = false;
    this.toastService.presentStdToastr(err);
  }

  getServices(event, refresh?){
    if(refresh) this.page = 0;
    if(this.type == 'posted'){
      this.serviceService.posted(this.page++, this.searchQuery)
      .then(
        resp => this.handleResponse(event, refresh, resp),
        err => this.handleError(err)
      );
    }else{
      this.serviceService.available(this.page++, this.searchQuery)
      .then(
        resp => this.handleResponse(event, refresh, resp),
        err => this.handleError(err)
      );
    }
  }
}
