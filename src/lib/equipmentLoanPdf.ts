import {supabase} from "./supabase"
export type EquipmentLoan={id:number;created_at:string;starts_at:string;ends_at:string;destination:string|null;status:string;legacy:boolean;snapshot:{institution?:string;timezone?:string;snapshot_at?:string;equipment:{inventory_code:string;equipment_type:string;manufacturer:string|null;model:string|null;serial_number:string|null;hospital_area:string|null;location:string|null};requester:{full_name:string;institutional_id:string;department:string|null}}}
export type LoanSignatures={delivery?:string;receipt?:string}
export async function getEquipmentLoan(id:number){
 if(!supabase)throw new Error("Supabase no está configurado")
 const {data,error}=await supabase.rpc("get_equipment_loan",{target_booking_id:id});if(error)throw error
 return data as EquipmentLoan
}
export function loanFolio(loan:EquipmentLoan){return `VP-${new Date(loan.created_at).getUTCFullYear()}-${String(loan.id).padStart(6,"0")}`}
export async function equipmentLoanPdf(loan:EquipmentLoan,signatures:LoanSignatures={}){
 const {jsPDF}=await import("jspdf")
 const pdf=new jsPDF({format:"a4",unit:"mm"}),ink=[28,49,68] as const,blue=[11,95,165] as const
 const date=(value:string)=>new Date(value).toLocaleString("es-MX",{timeZone:loan.snapshot.timezone||"America/Mexico_City",dateStyle:"medium",timeStyle:"short"})
 const value=(text?:string|null)=>text?.trim() || "No registrado"
 // Same vector mark as public/favicon.svg; no external logos or institution affiliations.
 function mark(x:number,y:number,size:number,pale=false){pdf.setFillColor(pale?242:11,pale?246:95,pale?250:165);pdf.roundedRect(x,y,size,size,size*.22,size*.22,"F");pdf.setDrawColor(pale?227:255,pale?235:255,pale?243:255);pdf.setLineWidth(size*.07);pdf.setLineCap("round");const points=[[10,33],[22,33],[28,21],[37,46],[43,33],[54,33]];for(let i=1;i<points.length;i++)pdf.line(x+points[i-1][0]/64*size,y+points[i-1][1]/64*size,x+points[i][0]/64*size,y+points[i][1]/64*size)}
 function header(){mark(53,100,104,true);mark(14,14,13);pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(18);pdf.text("BioMedGest",31,20);pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.setTextColor(...ink);pdf.text("Gestión de equipo médico",31,25);pdf.setFontSize(9);const org=loan.snapshot.institution;if(org && org!=="Institución sin configurar")pdf.text(pdf.splitTextToSize(org,180),14,34);pdf.setFillColor(...blue);pdf.roundedRect(14,40,182,13,2,2,"F");pdf.setTextColor(255,255,255);pdf.setFontSize(13);pdf.setFont("helvetica","bold");pdf.text("VALE DE PRÉSTAMO DE EQUIPO",20,48.5);pdf.setFontSize(9);pdf.setTextColor(...ink);pdf.text(loanFolio(loan),14,61);pdf.setFont("helvetica","normal");pdf.text(loan.status==="cancelado"?"RESERVA CANCELADA":"Reserva registrada",196,61,{align:"right"})}
 header();let y=68
 function space(height:number){if(y+height>276){pdf.addPage();header();y=70}}
 function section(title:string){space(12);pdf.setFillColor(232,240,248);pdf.rect(14,y,182,8,"F");pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.text(title,18,y+5.5);y+=10}
 function row(fields:[string,string][],minHeight=17){pdf.setFontSize(9);pdf.setFont("helvetica","normal");const w=182/fields.length;const lines=fields.map(([,text])=>pdf.splitTextToSize(text,w-9) as string[]);const height=Math.max(minHeight,10+Math.max(...lines.map(item=>item.length))*4.1);space(height+2);fields.forEach(([label],i)=>{const x=14+i*w;pdf.setDrawColor(192,208,221);pdf.setLineWidth(.25);pdf.rect(x,y,w,height);pdf.setFont("helvetica","bold");pdf.setFontSize(7.5);pdf.setTextColor(77,99,118);pdf.text(label,x+4,y+5);pdf.setFont("helvetica","normal");pdf.setFontSize(9);pdf.setTextColor(...ink);pdf.text(lines[i],x+4,y+10)});y+=height}
 const equipment=loan.snapshot.equipment,requester=loan.snapshot.requester
 section("PROGRAMACIÓN Y SERVICIOS")
 row([["SERVICIO / UBICACIÓN DE ORIGEN",[equipment.hospital_area,equipment.location].filter(Boolean).join(" · ")||"No registrado"],["SERVICIO / UBICACIÓN DE DESTINO",value(loan.destination)]])
 row([["INICIO DEL PRÉSTAMO",date(loan.starts_at)],["FIN PROGRAMADO",date(loan.ends_at)]])
 y+=4;section("IDENTIFICACIÓN DEL EQUIPO")
 row([["EQUIPO",value(equipment.equipment_type)],["FABRICANTE / MODELO",[equipment.manufacturer,equipment.model].filter(Boolean).join(" · ")||"No registrado"]])
 row([["NÚMERO DE INVENTARIO",value(equipment.inventory_code)],["NÚMERO DE SERIE",value(equipment.serial_number)]])
 y+=4;section("PERSONA SOLICITANTE / RECEPTORA")
 row([["NOMBRE",value(requester.full_name)],["ID INSTITUCIONAL",value(requester.institutional_id)]])
 row([["DEPARTAMENTO",value(requester.department)],["REGISTRO DE LA SOLICITUD",date(loan.created_at)]])
 y+=5;space(53);section("ENTREGA Y RECEPCIÓN")
 pdf.setFont("helvetica","normal");pdf.setFontSize(8);pdf.setTextColor(...ink);pdf.text("Complete las firmas al entregar y recibir el equipo. No incluye datos de pacientes.",14,y+3);y+=7
 const signatureY=y
 for(const [i,label,image] of [[0,"ENTREGA EL EQUIPO",signatures.delivery],[1,"RECIBE / SOLICITA",signatures.receipt]] as const){const x=14+i*94;if(image)pdf.addImage(image,"PNG",x+5,signatureY,78,21);pdf.setDrawColor(77,99,118);pdf.setLineWidth(.3);pdf.line(x,signatureY+23,x+88,signatureY+23);pdf.setFontSize(8);pdf.text("Firma · "+label,x,signatureY+28);pdf.setFontSize(7.5);if(i===1)pdf.text(pdf.splitTextToSize(requester.full_name,88),x,signatureY+33);else pdf.text("Nombre: __________________________________",x,signatureY+33)}
 const pages=pdf.getNumberOfPages()
 for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setTextColor(92,110,125);pdf.setFontSize(7);pdf.text(`${loanFolio(loan)} · BioMedGest · ${page}/${pages}`,14,287);pdf.text(`Horario: ${loan.snapshot.timezone||"America/Mexico_City"}`,196,287,{align:"right"});pdf.setFontSize(6.5);pdf.text(loan.legacy?"Registro previo: identificación consultada al generar este vale.":"Datos de identificación conservados al registrar la solicitud.",14,291)}
 pdf.setProperties({title:`Vale de préstamo ${loanFolio(loan)}`,author:"BioMedGest",subject:"Préstamo de equipo médico"})
 return pdf.output("blob")
}
